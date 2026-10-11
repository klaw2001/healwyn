# The AI voice assistant

A visitor taps **Talk to our assistant** (Home and Contact), or a coordinator places an assistant call from the CRM.
An AI assistant introduces itself as an AI, asks for consent, asks the pack's qualifying questions one at a time in
English or Hindi, confirms what it heard, and hangs up. The CRM receives a signed result, moves the lead to
AI-triaged, routes it with an explanation, and shows the summary to staff.

**Synthetic data only.** The language model runs on Gemini's free tier, whose inputs may be used to improve Google's
products. The agent refuses to start when `VOICE_REAL_DATA=true`. The call consent, the widget and the privacy notice
name LiveKit and Gemini as processors. The agent starts LiveKit sessions with `record=False`, so no audio or
transcript is uploaded to LiveKit Cloud, whatever the project's setting.

## How it works

```
 browser (widget)                 LiveKit Cloud                     apps/voice (Python)
 ────────────────                 ─────────────                     ───────────────────
 name, mobile, consents ──POST /api/assistant/start──▶ apps/web: lead created (source "voice"),
                                                         call started (consent, daily cap checked in SQL),
                                                         LiveKit token minted for room call-<id> with
                                                         the agent dispatched into it (metadata: ids)
 mic + captions ◀──── WebRTC room ────▶ agent worker: speech-to-text, intake engine, text-to-speech
                                                         │ end of call
 typed chat ──/api/assistant/turn──▶ text service ───────┤ (same engine)
 CRM dialer ──/simulate──────────────▶ text service ─────┤
                                                         ▼
                                       POST /api/voice/complete (HMAC, 5-minute window) ──▶ apps/crm:
                                       record call, update lead, AI-triaged, routing, urgent task, score
```

One engine, four entry points. `apps/voice/healwyn_voice/dialogue.py` (`IntakeSession`) is the whole conversation.
The LiveKit agent (`agent.py`), the typed chat and the simulated dialer (`server.py`), and the eval harness
(`eval.py`) all drive it, so what is evaluated is what runs.

**Everything the assistant says comes from the industry pack** (`packages/core/src/industries/clinic-voice.ts`),
exported to `packages/core/contracts/voice-script.clinic.json` by `pnpm contracts`. Every reply is a fixed line from
that script: the greeting, the questions, the reprompts, the confirmation, the emergency advice, the refusals. **No
model output is ever spoken.** The LiveKit session has no LLM attached; Gemini is used only as a classifier.

### A turn, step by step

1. **Safety first, on every turn, in every language.** `safety.py` matches the pack's phrase lists:
   - **Red flags:** chest pain, breathing difficulty, severe bleeding, stroke signs, suicidal thoughts,
     unconsciousness, seizure, severe allergic reaction, poisoning or overdose, bleeding in pregnancy, serious injury,
     and "it's an emergency". A red flag stops the intake at any point, even before consent. The caller is told to
     call 112 or go to the nearest hospital, the lead is flagged urgent, and an urgent call-back task is created.
     Negations ("no chest pain", "सीने में दर्द नहीं") are respected; when in doubt it fires.
   - **Medical-advice requests:** diagnosis, medicine, dose, report interpretation. They are declined kindly, with
     an offer of a doctor's call back, and the intake continues. Any answer in the same sentence is still used.
   - **Attempts to change the rules or reveal instructions** get a fixed refusal, then the same question again.
   - **"Are you a person?"** gets an honest answer.
2. **Hang-ups and limits.** "Bye" ends the call. Calls are limited to 5 minutes and 40 turns.
3. **Understanding the answer.** `nlu.py` matches option labels and synonyms in English, Hindi (Devanagari) and
   romanised Hinglish. Only when that fails does `llm.py` ask Gemini to map the answer to one option value, with the
   caller's words passed as quoted data. The result must be an exact option value, or it is ignored.
4. **Recovery.** One retry ("Sorry, I didn't quite catch that"), or a redirect for off-topic talk. Then the question
   is left for a person to confirm; for the specialty question, "not sure" means a coordinator triages.
5. **Language.** It switches to Hindi when the caller speaks Hindi (Devanagari, or several common romanised words),
   and back to English for clearly English sentences.
6. **Confirmation and close.** It reads the answers back, lets the caller correct them ("no, evenings"), then closes
   with the call-back window and the emergency number.

### What reaches the CRM

The result follows the `VoiceCallResult` contract (`packages/core/src/voice/contract.ts`; pydantic model generated
into `apps/voice/healwyn_voice/contracts.py`). It carries:

- the answers by question id;
- the language, urgency and outcome;
- safety flags (codes only);
- a 3–5 line summary;
- the transcript;
- usage counters.

The CRM validates the answers against the pack. In one transaction it then:

- records the call (`call_sessions`, row level security);
- merges the answers into the lead;
- moves a new lead to AI-triaged with that stage's nurture plan;
- runs the routing engine if nobody owns the lead;
- creates an urgent task after a red flag;
- rescores the lead.

Replays of the same call change nothing. Before the caller agrees to continue, their words are not kept: the
transcript stores only the assistant's lines. An explicit "no" withdraws the call consent, so the dialer will not call
again; an unclear answer or a hang-up collects nothing and withdraws nothing. Erasure scrubs call content, including
which red flag was raised (the audit trail only records that one was).

## Providers (checked 2026-10-10; see DECISIONS.md)

| Part           | Default                                                         | Free allowance                                                                                     | Config                               |
| -------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Rooms, agents  | LiveKit Cloud, Build plan                                       | 1,000 agent session minutes a month, 5 concurrent sessions, 1 agent deployment, no card            | `LIVEKIT_*`                          |
| Speech-to-text | `deepgram/nova-3`, `language="multi"` through LiveKit Inference | US$2.50 a month of Inference credit (hard cap); at US$0.0058 a minute that is about 430 minutes    | `VOICE_STT_MODEL`                    |
| Text-to-speech | `rime/coda` through LiveKit Inference                           | US$0.00 a character when checked (no end date stated); two Hindi voices                            | `VOICE_TTS_MODEL`, `VOICE_TTS_VOICE` |
| Understanding  | `gemini-3.5-flash-lite`, AI Studio free tier                    | 15 requests a minute (observed in a 429 response, 2026-10-11); daily limit shown only in AI Studio | `VOICE_LLM_MODEL`, `VOICE_USE_LLM`   |

Every provider is swappable through config. Fallbacks:

- **Speech:** Inworld TTS on the same LiveKit credit; Gemini TTS (free tier); or Deepgram's own plugin ($200 one-time
  credit) with Sarvam for Indian voices.
- **Understanding:** with `VOICE_USE_LLM=false` the assistant runs fully deterministically. It is slightly less
  forgiving of descriptions, as the eval shows.

## Cost guards

- **Per call:** 5 minutes and 40 turns, both from the pack. The agent ends the call politely when either runs out.
- **Per day:** 50 calls per group (website, real phone, simulated; pack `limits.maxCallsPerDay`) and 3 website calls
  per phone number (`limits.maxCallsPerPhonePerDay`), enforced in SQL when a call starts from `call_policies`, which
  the seed writes from the pack. A transaction-level advisory lock makes the caps exact under concurrency. The website
  and the dialer then refuse with a clear message. Starts are also limited to 5 per 10 minutes per IP, failing closed.
- **Per call to Gemini:** only when the deterministic matcher fails, with a 6-second timeout. Failures (including the
  free tier's 429) count as "no match". Batch runs pace themselves (one request every 4.5 s).
- **Visibility:** the manager's **AI assistant** screen in the CRM shows today against the cap, and the month
  against LiveKit's agent minutes and Inference credit. It also shows Gemini requests, recent calls and the verified
  demo numbers.

## The phone path

- **Simulated dialer (works now).** **Simulated assistant call** on a lead's profile runs the real engine, with the
  lead's own form answers as the caller's lines. It goes through the same webhook, routing and summary as a real
  call. Every check except the call window runs in SQL: call consent present and not withdrawn, not opted out, daily
  cap. A refusal is written to the timeline with its reason. The 9am–9pm window applies to real calls only; a
  simulated call rings nobody.
- **Real calls (not set up).** **Phone call** is enabled when `LIVEKIT_SIP_TRUNK_ID` is set. The CRM then:
  1. checks everything above, plus the 9am–9pm India time window and the verified demo number list;
  2. dispatches the agent into a new room;
  3. asks LiveKit SIP to dial the lead (`apps/crm/lib/server/dialer.ts`).

  To connect a real trunk:
  1. Create a Twilio trial account and verify the demo phone numbers in Twilio. A trial can call only verified numbers,
     and trial calls start with a Twilio notice and are time-limited.
  2. Create an Elastic SIP trunk in Twilio with credential authentication.
  3. In LiveKit Cloud (or with the `lk` CLI), create an outbound SIP trunk that points at the Twilio termination URI
     with those credentials and the Twilio number. Put its id in `LIVEKIT_SIP_TRUNK_ID` for the CRM.
  4. Add the same verified numbers on the CRM's **AI assistant** screen. The CRM refuses any other number, even if
     Twilio would allow it.

  None of this was tested: no trunk exists. A Twilio trial needs sign-up and phone verification, which this build did
  not do on the user's behalf.

## Run it locally

```bash
pnpm voice:setup                       # Python 3.12+ venv in apps/voice/.venv (uv if available), incl. LiveKit Agents
pnpm voice:serve                       # text service on VOICE_TEXT_URL (typed chat + simulated dialer)
pnpm voice:agent dev                   # LiveKit agent worker (needs LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
pnpm eval:voice                        # 43 scripted scenarios -> docs/VOICE_EVAL.md (add `-- --llm` to include Gemini)
pnpm test:voice                        # pytest (safety lists, conversation flows, text service, eval)
```

Set `VOICE_WEBHOOK_SECRET` and `VOICE_AGENT_SECRET` (32+ characters each) in the root `.env`, plus `CRM_URL` for the
agent. With the website, CRM and text service running, the widget works by typing anywhere. Voice works where the
browser can reach LiveKit over WebRTC; if it cannot, the widget falls back to typing within seconds.

## Deploy on free tiers

- **Agent:** LiveKit Cloud agent hosting (Build plan: one deployment). Deploy `apps/voice` with LiveKit's `lk agent`
  CLI and a Dockerfile that installs `requirements.txt` and runs `python -m healwyn_voice.agent start`. Set the
  `VOICE_*`, `GEMINI_API_KEY` and `CRM_URL` secrets, and copy `packages/core/contracts/voice-script.clinic.json` into
  the image (point `VOICE_SCRIPT_PATH` at it). Session minutes on hosted agents count towards the 1,000 a month.
- **Text service:** any small Python host. Render's free web service gives 750 instance hours a month, which covers
  one always-on service. It sleeps after 15 minutes without traffic and takes about a minute to wake, and Render says
  free instances are not for production ([docs](https://render.com/docs/free), checked 2026-10-11). The CRM's
  scheduled function can ping `/health` every 10 minutes to keep it awake.
- **Website and CRM:** Netlify, as before. Add the voice variables to both sites:
  - website: `LIVEKIT_*`, `VOICE_TEXT_URL`, `VOICE_AGENT_SECRET`;
  - CRM: `VOICE_WEBHOOK_SECRET`, `VOICE_TEXT_URL`, `VOICE_AGENT_SECRET`, and `LIVEKIT_*` plus `LIVEKIT_SIP_TRUNK_ID`
    for real calls.

## Latency

**Measured:**

- **Engine time per caller turn (text in, reply out):** median under 1 ms. With a Gemini classification it is
  0.7–1.1 s, needed only for answers the matcher cannot place (see docs/VOICE_EVAL.md).
- **Typed chat through the website** (browser → web → text service → back, phone-sized viewport): 50–190 ms per turn.

**Not measured: caller stops speaking → assistant starts speaking.** This sandbox cannot carry real-time audio. The
agent registered with LiveKit Cloud, but WebRTC peer connections time out here: UDP is blocked and the proxy offers
no TURN route. Headless Chromium also could not open LiveKit's WebSocket through the proxy.

On a real network, the delay is roughly:

- the end-of-turn delay (silence detection);
- plus speech-to-text finalisation;
- plus the engine (milliseconds, or about 1 s when Gemini is needed);
- plus text-to-speech time-to-first-byte.

The agent logs the measured parts per turn: `agent.latency` with `endOfUtteranceMs` and `ttsFirstByteMs`, and
`agent.turn` with `engineMs`. To tune it:

- lower the VAD silence threshold;
- keep the deterministic matcher's synonym lists rich, so Gemini is rarely needed;
- choose a TTS with a low first byte.

When the browser cannot connect to LiveKit, the widget hands over to typed chat in about 5 seconds (measured here).
`room.connect` is capped at 12 seconds. The fallback happens once per call: the database switches the call from
browser to typed, and a late result from the voice agent for it is ignored.
