# apps/voice: the intake assistant

A Python app that qualifies new leads by voice or typed chat. It says it is an AI, asks for consent, asks the pack's
qualifying questions, never gives medical advice, escalates red-flag symptoms to emergency services, and posts a
signed, validated result to the CRM. The full design, provider limits and deployment notes are in
[`docs/VOICE.md`](../../docs/VOICE.md); the evaluation report is [`docs/VOICE_EVAL.md`](../../docs/VOICE_EVAL.md).

Synthetic data only. The free Gemini tier may use inputs to improve Google's products, so the agent refuses to start
when `VOICE_REAL_DATA=true`.

## Commands (from the repo root)

| Command                | What it does                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm voice:setup`     | Create `apps/voice/.venv` (uv when available) with the dev tools and the LiveKit agent        |
| `pnpm voice:serve`     | Text service on `VOICE_TEXT_URL` (default http://127.0.0.1:8090): typed chat, simulated calls |
| `pnpm voice:agent dev` | LiveKit agent worker (needs `LIVEKIT_*`); `start` for production, `console` for a local mic   |
| `pnpm eval:voice`      | Run the 43 scenarios and rewrite `docs/VOICE_EVAL.md` (`-- --llm` to include Gemini)          |
| `pnpm test:voice`      | pytest                                                                                        |
| `pnpm lint:voice`      | ruff check + ruff format --check                                                              |
| `pnpm contracts`       | Regenerate the JSON Schemas, the voice script and `healwyn_voice/contracts.py` from zod       |

`pnpm check` runs `lint:voice`, `contracts:check` and `test:voice`, so the Python side is part of the commit gate.

## Modules

| Module              | Role                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `contracts.py`      | Generated pydantic models (do not edit; `pnpm contracts`)                                                |
| `config.py`         | Settings from the environment and the root `.env`; loads the pack's voice script                         |
| `dialogue.py`       | `IntakeSession`: the deterministic state machine every channel shares                                    |
| `safety.py`         | Red flags (with negations), advice requests, prompt injection: checked first on every turn               |
| `nlu.py`, `text.py` | Deterministic understanding: yes/no/skip/hang-up, option synonyms (English, Hindi, Hinglish), language   |
| `llm.py`            | `OptionClassifier`: Gemini picks one of the allowed options or "none"; output is validated, never spoken |
| `server.py`         | Text service (`/sessions`, `/sessions/<id>/turns`, `/sessions/<id>/end`, `/simulate`), HMAC-signed       |
| `agent.py`          | LiveKit agent: speech in, engine, `session.say()` out; no LLM is attached to the voice pipeline          |
| `webhook.py`        | Signs and posts the call result to the CRM (`/api/voice/complete`)                                       |
| `log.py`            | JSON logs; refuses field names that could carry personal data                                            |
| `eval*.py`          | Evaluation harness and scenarios                                                                         |

## The contract

The pack's voice script (`packages/core/contracts/voice-script.clinic.json`) holds every line the assistant can say,
the questions, synonyms and safety phrases. The call result is validated twice: by pydantic before it is posted, and
by zod in the CRM. Changing the zod schemas without regenerating fails `pnpm contracts:check`.
