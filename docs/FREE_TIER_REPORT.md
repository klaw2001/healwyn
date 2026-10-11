# Free tier report

Checked on **2026-10-11**. Prices are in US dollars unless marked INR, and exclude taxes unless stated. Pricing pages
change often: re-check the linked source before quoting a figure to a client. Where a figure could not be confirmed
from the provider's own page, this report says so.

## How the project uses each service

The numbers below come from the code and docs in this repository, not from guesses about a generic app.

| Unit of work           | What it costs in external services                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 enquiry (form)       | 1 server action on Netlify, 1 `submit_lead` call to Postgres, 1 team notification email, then 2 to 5 nurture emails as the lead moves through stages (`clinic-crm.ts`: welcome + nudge, follow-up x2, appointment, no-show, post-visit). Call it **4 to 7 emails per enquiry**. WhatsApp and SMS steps are recorded as simulated and cost nothing today. |
| 1 assistant call       | 2 to 4 minutes in a LiveKit room (1 agent session), speech-to-text for the whole call, text-to-speech for the assistant's lines (about 1,000 to 1,500 characters in English, measured from `voice-script.clinic.json`), and up to 6 to 10 Gemini requests (only when the built-in matcher cannot place an answer, so usually fewer).                     |
| Always, with no visits | The CRM's Netlify scheduled function runs every 5 minutes (`nurture-cron.mts`): about 8,640 runs a month, each calling the CRM's `/api/cron/nurture` route, which talks to Postgres.                                                                                                                                                                     |
| Each code change       | One production deploy per site. There are two Netlify sites (website and CRM) on one account.                                                                                                                                                                                                                                                            |

Things that are **not** external services: fonts are self-hosted, there is no analytics or tracking, and the browser
speech APIs are not used (speech runs through LiveKit). The repository has no GitHub Actions workflows; the commit gate
(`pnpm check`) runs locally.

---

## 1. Netlify (hosting for the website and the CRM)

**Use:** hosts both Next.js apps (pages, server actions, API routes) and runs the 5-minute nurture cron.

**Free limits (2026-10-11):**

- 300 credits a month, shared by every site on the account. Credits pay for: production deploy 15 credits, compute 10
  credits per GB-hour (functions default to 1 GB of memory), bandwidth 20 credits per GB, web requests 2 credits per
  10,000. Deploy Previews, branch deploys, failed deploys and form submissions cost nothing.
- Hard limit: when credits run out, **every project on the account is paused** and shows "Site not available" until the
  monthly reset. Free accounts cannot buy extra credits.
- Scheduled functions are on all plans, run only on published deploys and have a 30-second execution limit.
- Commercial use: the Self-Serve Subscription Agreement does not restrict the Free Usage Tier to personal or
  non-commercial use (section 6 describes it as a way "to experience Netlify's Services", offered at Netlify's
  discretion with no service level commitments). The separate Terms of Use were not re-read today; `DECISIONS.md`
  records that they had no such restriction when last checked.

Sources: <https://www.netlify.com/pricing/>,
<https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/>,
<https://docs.netlify.com/build/functions/usage-and-billing/>,
<https://docs.netlify.com/build/functions/scheduled-functions/>,
<https://www.netlify.com/legal/self-serve-subscription-agreement/>

**Where the demo breaks first: production deploys, then the cron.** A rough monthly budget:

| Item                                         | Calculation                                                                                                                                         | Credits      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Nurture cron (no traffic at all)             | 8,640 runs x 2 function invocations x about 1 to 1.5 s at 1 GB = 5 to 7 GB-hours (estimate; durations not measured on Netlify)                      | about 30-70  |
| Production deploys                           | 15 credits each; deploying both sites once = 30                                                                                                     | 30 per round |
| Website traffic per enquiry                  | Pages are prerendered. About 15 visits per enquiry x about 0.4-0.5 MB (measured JS bundle is about 370 KB gzipped in total) = 6-8 MB, plus requests | about 0.3    |
| CRM staff use (5 staff, about 100 views/day) | 15,000 server-rendered views x about 0.5 s at 1 GB = about 2 GB-hours                                                                               | about 20     |

So **about 7 or 8 rounds of deploying both sites in a month uses up the whole allowance** before any visitor arrives. With
only 2 or 3 deploy rounds, traffic would run out the rest at roughly **300 to 450 enquiries a month**. When it runs out,
the website, the CRM and the nurture cron all stop together, and once the cron stops, Supabase can pause a week later
(see below). Cheap fixes on Free: turn off automatic production publishing and test on Deploy Previews (free); run the
cron every 15 minutes instead of 5 (cuts that line by two thirds).

**Cheapest upgrade:** Personal, **$9 a month**, 1,000 credits (extra packs: 500 credits for $5). Pro is $20 a month for
3,000 credits (higher tiers: 5,000 for $33, 10,000 for $63). Source: <https://www.netlify.com/pricing/>,
<https://www.netlify.com/changelog/2026-07-14-pro-plan-credit-tiers/>

**At 500 leads and 200 calls a month:** 500 x 0.3 + cron 30-70 + CRM 20-40 + 8 deploys x 15 = about 320 to 380 credits.
That is over Free and well inside Personal. **Cost: $9 a month.**

---

## 2. Supabase (Postgres, Auth)

**Use:** the database for everything (leads, consents, audit, nurture queue, calls) with RLS; Supabase Auth holds staff
accounts.

**Free limits (2026-10-11):** 500 MB database per project, 5 GB egress (plus 5 GB cached egress), 50,000 monthly active
users, 1 GB file storage, 500,000 Edge Function invocations, 2 active free projects. **Free projects are paused after a
week without enough database activity**; a paused project is resumed from the dashboard. The pausing page is
inconsistent on how long a paused project can be restored (its heading says 90 days, its text says 1 year). Paid
projects are never paused.

Sources: <https://supabase.com/pricing>, <https://supabase.com/docs/guides/platform/free-project-pausing>,
<https://supabase.com/docs/guides/platform/billing-on-supabase>

**Where the demo breaks first: pausing, not size.** The 5-minute nurture cron queries the database 288 times a day, so
while the CRM site is live the project stays active. But if the Netlify account pauses (credits used up) or the cron is
removed, the database pauses about a week later, and both apps then fail until someone resumes it by hand. Size is far
off: a lead with its consents, events, messages and a call record is a few tens of KB at most (estimate), and leads
untouched for 12 months are erased by `purge_stale_leads`, so 500 MB holds well over 10,000 live leads. Egress from
staff page views (estimate 15,000 views x about 50 KB = under 1 GB) is also well inside 5 GB. Auth users are staff
only.

**Cheapest upgrade:** Pro, **$25 a month**, which includes $10 of compute credit covering one Micro instance (1 GB RAM),
8 GB disk, 250 GB egress, 100,000 MAU, daily backups kept 7 days, and no pausing. Source: <https://supabase.com/pricing>

**At 500 leads and 200 calls a month:** fits Free on size and traffic, but a paying client should not run on a project
that can pause and has no listed backups on Free. **Cost: $25 a month.**

---

## 3. Resend (email)

**Use:** the team's new-lead notification and the nurture emails, with an idempotency key per step.

**Free limits (2026-10-11):** 3,000 emails a month and **100 emails a day** (UTC day), up to 3 verified domains, API
limit 10 requests a second per team. Every To, CC and BCC recipient counts. Sending can be paused if bounces go above
4% or spam complaints above 0.08%. Without a verified domain, mail is sent from `onboarding@resend.dev`, which only
delivers to the account owner's own address (`DECISIONS.md`), so real patients cannot receive nurture emails until a
domain is verified. A domain costs money; its price was not looked up for this report.

Sources: <https://resend.com/pricing>, <https://resend.com/docs/knowledge-base/account-quotas-and-limits>

**Where the demo breaks first: the daily cap.** At 4 to 7 emails per enquiry, steady daily traffic of **about 15 to 25
new enquiries a day** fills 100 emails a day. The monthly cap allows about 3,000 / 7 to 3,000 / 4 = **430 to 750
enquiries a month**. A single busy day (for example, a demo where many leads are moved to a new stage at once) can hit
the daily cap first; failed steps are retried with back-off, up to three attempts.

**Cheapest upgrade:** Pro, **$20 a month** for 50,000 emails (overage $0.90 per 1,000); no daily limit is listed for
it. Source: <https://resend.com/pricing>

**At 500 leads a month:** 500 x 4 to 7 = 2,000 to 3,500 emails, about 70 to 115 a day. That is at or over both free caps.
**Cost: $20 a month.**

---

## 4. LiveKit Cloud (voice rooms, agent hosting, speech)

**Use:** the browser voice call: WebRTC room, hosting the Python agent, and speech-to-text (`deepgram/nova-3`
multilingual) and text-to-speech (`rime/coda`) through LiveKit Inference.

**Free (Build plan) limits (2026-10-11):** no card required; 1,000 agent session minutes a month; 5,000 WebRTC
participant minutes; 50 GB downstream data; 5 concurrent agent sessions; 1 agent deployment; **$2.50 of Inference
credit a month**; 1,000 third-party SIP minutes. On Build every allowance is a **hard cap**: once exceeded, new requests
fail (LiveKit staff say Inference returns 429 errors) until the 1st of the next month. Allowances are shared across all
of a user's free projects. Build agents may be shut down when idle, adding 10 to 20 seconds to the next call's start.

Speech prices on Build and Ship: Deepgram Nova-3 multilingual **$0.0058 a minute**. Rime Coda text-to-speech is
**listed two ways on the same day**: $50.00 per million characters on <https://livekit.com/pricing/inference>, and
$0 on <https://livekit.com/pricing.md>. This report plans for $50 per million. (The project's `docs/VOICE.md` recorded
$0 when it was written.) Cheaper voices on the same price list: Rime Mist v3 $30, Inworld Realtime TTS 2.0 Flash $15
per million characters.

Sources: <https://livekit.com/pricing>, <https://livekit.com/pricing/inference>, <https://livekit.com/pricing.md>,
<https://docs.livekit.io/deploy/admin/quotas-and-limits/>,
<https://community.livekit.io/t/question-about-free-inference-credits-limit/1131>

**Where the demo breaks first: the $2.50 Inference credit.** Per 3-minute call: speech-to-text 3 x $0.0058 = $0.017,
text-to-speech about 1,300 characters x $50 per million = $0.065, so **about $0.08 a call**. $2.50 / $0.08 = **about 30
voice calls a month** (25 to 35 for 2- to 4-minute calls). If Rime Coda really is free, speech-to-text alone allows
about 430 minutes, or **about 110 to 210 calls**. After that, voice stops for the month; typed chat keeps working because
it runs on the separate text service. The other limits are much further away:

- agent session minutes: 1,000 / 2 to 4 = 250 to 500 calls;
- WebRTC minutes: 5,000 / (2 participants x 2 to 4 min) = about 600 to 1,250 calls (it is not stated whether a
  cloud-hosted agent counts as a participant);
- data: Opus audio at about 32 to 48 kbit/s is roughly 1 to 2 MB a call, so 50 GB is tens of thousands of calls;
- concurrency: 5 calls at once.

**Cheapest upgrade:** Ship, **from $50 a month**: 5,000 agent minutes ($0.01 a minute after), 150,000 WebRTC minutes,
250 GB, 20 concurrent sessions, 2 deployments, $5 Inference credit then pay per use, 5,000 SIP minutes. Source:
<https://livekit.com/pricing>

A cheaper bridge exists but is less suitable for a paying client: stay on Build and call Deepgram directly with its own
key (Nova-3 multilingual $0.0058 a minute, Aura-2 speech $0.030 per 1,000 characters, $200 one-time free credit, no
card; the streaming rates are marked as promotional). That needs a code change to use the Deepgram plugin instead of
LiveKit Inference, keeps Build's hard caps and idle shutdowns, and Hindi voice support on Aura-2 was not checked.
Source: <https://deepgram.com/pricing>

**At 200 calls a month (about 600 minutes):** agent minutes are inside Ship's 5,000. Inference: 200 x $0.08 = $16, minus
$5 credit = about $11. **Cost: about $61 a month** (about $50 if Rime Coda is $0, or about $55 with a $15-per-million
voice).

---

## 5. Google Gemini API (answer classifier)

**Use:** when the assistant's own matcher cannot place a free answer, Gemini maps it to one of the question's allowed
options (text only, temperature 0, a prompt of a few hundred tokens). Gemini never writes what the assistant says.

**Free limits (2026-10-11):** the model in use, `gemini-3.5-flash-lite`, has a free tier. Google no longer publishes
per-model free-tier numbers on its rate-limit page; they are shown only inside AI Studio. The project observed **15
requests a minute** in a 429 response on 2026-10-11 (`DECISIONS.md`). **The daily request limit could not be verified**
from a public page. Tier 1 needs only a linked billing account and usually applies at once; its numbers are also shown
only in AI Studio.

**Privacy:** on the free tier, Google uses submitted content and responses "to provide, improve, and develop" its
products, "human reviewers may read, annotate, and process" inputs and outputs, and the terms say "Do not submit
sensitive, confidential, or personal information to the Unpaid Services." On the paid tier, prompts and responses are
not used to improve products; they are logged for a limited period only to detect abuse. For a clinic this is
decisive: callers describe health concerns, so **a real deployment must use the paid tier**, and the free tier is fit
only for the synthetic demo (the agent already refuses to start with `VOICE_REAL_DATA=true`). The API terms also
require users to be 18 or older and bar apps likely to be used by under-18s.

Sources: <https://ai.google.dev/gemini-api/docs/pricing>, <https://ai.google.dev/gemini-api/docs/rate-limits>,
<https://ai.google.dev/gemini-api/terms>

**Where the demo breaks first: requests per minute.** One call makes up to 6 to 10 requests over 2 to 4 minutes, about
2 to 5 a minute, so **about 3 simultaneous calls** reach 15 a minute. Extra requests get a 429, which the engine treats
as "no match" and asks again, so calls get slower and less forgiving rather than failing. If the daily cap is in the low
hundreds (unverified), it would allow only a few dozen calls a day.

**Cheapest upgrade:** paid tier (Tier 1). `gemini-3.5-flash-lite` costs $0.30 per million input tokens and $2.50 per
million output tokens; `gemini-2.5-flash-lite` is cheaper at $0.10 / $0.40. Source:
<https://ai.google.dev/gemini-api/docs/pricing>

**At 200 calls a month:** at most 2,000 requests x about 400 input tokens = 0.8 million tokens ($0.24) plus about 40,000
output tokens ($0.10). **Cost: under $1 a month.**

---

## 6. Razorpay (test-mode payments)

**Use:** booking payments in test mode. Not built yet: `NEXT.md` plans server-side orders, signature checks, and refusing
any key that does not start with `rzp_test_`.

**Free limits (2026-10-11):** test mode moves no money, so there is nothing to pay; Razorpay does not publish a separate
price for it, and it can be used while KYC is pending. Live mode needs KYC verification, which Razorpay's quickstart
says takes about 24 to 48 hours; the list of documents is shown in the dashboard and was not checked here. A paying
clinic would need **its own** Razorpay account and KYC, not the developer's.

**Live fees (standard plan, India):** 2% platform fee per successful domestic transaction, cards, netbanking, wallets
and UPI alike (the page says UPI and RuPay debit are "Zero MDR - 2% platform fee applies"); corporate cards 2.15%;
international cards up to 3%; 18% GST on the fee; no setup or annual fee. Source: <https://razorpay.com/pricing/>,
<https://razorpay.com/docs/payments/quickstart.md>

**Where the demo breaks first:** it does not, in test mode.

**At small client scale:** cost depends on payments, not leads. Example only: 100 paid bookings of INR 500 a month =
INR 50,000 x 2% = INR 1,000, plus 18% GST = **about INR 1,180 a month**. No fixed monthly fee.

---

## 7. Render (the assistant's text service)

Not in the original list, but the deployed design depends on it (`docs/VOICE.md`): typed chat and the simulated dialer
call the Python text service.

**Free limits (2026-10-11):** 750 instance hours a month per workspace (enough for one service running all month); the
service **sleeps after 15 minutes without traffic and takes about a minute to wake**; Render says free instances must
not be used for production. Source: <https://render.com/docs/free>

**Where the demo breaks first:** not on volume but on latency: the first typed chat after a quiet spell waits about a
minute.

**Cheapest upgrade:** Starter instance, always on, **$7 a month** (512 MB, 0.5 CPU). The official pricing page did not
render for checking; this figure comes from third-party listings (<https://render.com/pricing>,
<https://makerkit.dev/pricing-calculator/render>), so confirm it. **Cost at small client scale: $7 a month.**

---

## 8. GitHub (repository)

**Use:** hosts the repository; Netlify builds from it. No Actions workflows exist, so no Actions minutes are used.

**Free limits (2026-10-11):** GitHub Free includes 2,000 Actions minutes a month for private repositories (free and
unlimited on standard runners for public repositories), 500 MB artifact storage and 10 GB cache per repository; beyond
that, Linux 2-core runners cost $0.006 a minute. Private repositories on GitHub Free were not re-checked today. Source:
<https://docs.github.com/en/billing/concepts/product-billing/github-actions>

**Where the demo breaks first:** it does not. If `pnpm check` were moved to Actions on a private repository, at roughly
10 to 15 minutes a run, 2,000 minutes would allow about 130 to 200 runs a month (estimate). **Cost: $0.**

---

## 9. Optional: real phone calls in India (SIP trunk)

Real calls need a SIP trunk connected to LiveKit (`LIVEKIT_SIP_TRUNK_ID`); none is configured.

- **Twilio is not a fit for calling Indian numbers.** Twilio's India guidelines say "Outbound calls to India can only be
  made from international (non-Indian) numbers", list domestic calling as not available, and warn that many short calls
  can trigger carrier blocks. The Twilio trial path in `docs/VOICE.md` would therefore show a foreign caller ID to
  Indian patients. For reference, Twilio lists $0.0496 a minute to Indian mobiles. Source:
  <https://www.twilio.com/en-us/guidelines/in/voice>, <https://www.twilio.com/en-us/voice/pricing/in>
- **Plivo (India pricing page):** domestic calls INR 0.38 a minute (30-second pulse), Indian numbers INR 200 a month.
  The page links to a separate requirements FAQ (likely business KYC) that was not checked, and it was not confirmed
  that this rate applies when Plivo is used as a SIP trunk for LiveKit. Source: <https://www.plivo.com/voice/pricing/in/>
- **Exotel:** prepaid bundles, for example Dabbler INR 9,999 for 5 months (INR 4,999 rental, 5,000 credits, 1 number,
  3 agents; 1 credit = INR 1), 7-day trial with 500 credits. Per-minute rates are not published, and voice streaming to
  an AI agent ("AgentStream") is priced separately through sales. Source:
  <https://exotel.com/pricing/business-phone-system/>
- **LiveKit side:** Build includes 1,000 third-party SIP minutes, Ship 5,000 (then $0.004 a minute).

**Rules for outbound calls in India:** TRAI's TCCCPR rules treat commercial calls without the recipient's consent as
unsolicited commercial communication, which can lead to blocking or disconnection of all the sender's connections
(strengthened by a February 2025 amendment). Promotional calls must come from 140-series numbers by senders registered
with telecom operators, and are blockable through the DND registry; 1600-series numbers are reserved for service and
transactional calls by RBI, SEBI, PFRDA and IRDAI-regulated entities (a clinic is none of these). Whether a clinic's
consented follow-up call counts as service or promotional, and exactly what registration applies, was not settled by
the sources found: get the telephony provider's confirmation before going live. The project already requires a separate
call consent, a 9am-9pm window and daily caps. Sources: <https://www.trai.gov.in/sites/default/files/2025-11/PR_No.135of2025.pdf>,
<https://www.trai.gov.in/sites/default/files/2025-12/PR_No.151of2025.pdf>, <https://www.scconline.com/blog/?p=390749>

**At 200 calls a month (600 minutes) through Plivo:** 600 x INR 0.38 + INR 200 number = **about INR 430 a month**
(unverified for SIP use), plus SIP minutes inside LiveKit Ship's allowance.

---

## 10. Optional: SMS and WhatsApp (simulated today)

**WhatsApp Business Platform:** since 1 July 2025 Meta charges per template message, by category (marketing, utility,
authentication) and country. Free-form replies inside the 24-hour customer service window are free, and so are utility
templates sent inside it. Meta raised the India marketing rate on 1 January 2026 and requires INR billing by 31 December 2026. **Meta's own India figures could not be read** (the rate card is behind an interactive selector). A WhatsApp
partner's published India card lists, per message: marketing INR 0.9926, utility INR 0.1323, authentication INR 0.1323;
it does not say whether that includes its own markup, and partners usually add a platform fee. Sources:
<https://developers.facebook.com/docs/whatsapp/pricing/>,
<https://business.whatsapp.com/products/platform-pricing#rates>,
<https://docs.gallabox.com/pricing-and-billing/whatsapp-pricing/rate-card.md>

**SMS:** every business sender in India must register on a DLT platform (entity, sender header, each message template)
before messages are delivered. The one-time entity fee is most often quoted as **INR 5,900** (some sources say INR 5,000
plus GST, or INR 5,000 to 10,000); this comes from providers' guides, not an operator page. A typical provider price is
INR 0.25 per SMS at the 5,000-message tier, plus 18% GST. Sources: <https://msg91.com/in/pricing/sms>,
<https://www.infobip.com/docs/essentials/dlt-registration>,
<https://developer.exotel.com/docs/sms-support/dlt-registration>

**At 500 leads a month:** the clinic sequences hold about 1 to 2 WhatsApp steps and 1 SMS step per lead on a typical
path. WhatsApp: 750 utility messages x INR 0.13 = about INR 100 (about INR 750 if billed as marketing), plus any partner
fee. SMS: 500 x INR 0.25 x 1.18 = **about INR 150 a month**, plus the one-time DLT fee.

---

## Summary

| Service             | Free limit (2026-10-11)                                                          | First break point                                                                      | Cheapest upgrade                              | Monthly cost at 500 leads, 200 calls   |
| ------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------- |
| Netlify             | 300 credits, shared by both sites; whole account pauses when used up             | About 7-8 rounds of deploying both sites a month; else about 300-450 enquiries a month | Personal, 1,000 credits                       | $9                                     |
| Supabase            | 500 MB DB, 5 GB egress, 2 projects; pauses after a week without activity         | Pauses about a week after the nurture cron stops; size is far off                      | Pro, includes Micro compute, no pausing       | $25                                    |
| Resend              | 3,000 emails a month, 100 a day; real recipients need a verified domain          | About 15-25 enquiries a day, or 430-750 a month                                        | Pro, 50,000 emails                            | $20                                    |
| LiveKit Cloud       | 1,000 agent min, 5,000 WebRTC min, 50 GB, 5 concurrent, $2.50 Inference credit   | Inference credit: about 30 voice calls a month (about 110-210 if Rime Coda is free)    | Ship, 5,000 agent min, $5 credit then per use | about $61 (about $50-55 with savings)  |
| Gemini API          | Free tier; 15 requests a minute observed; daily limit unverified; data may train | About 3 simultaneous calls; free tier unusable for real patient data                   | Paid Tier 1, pay per token                    | under $1                               |
| Render (text svc)   | 750 hours a month; sleeps after 15 min; "not for production"                     | First typed chat after 15 quiet minutes waits about a minute                           | Starter, always on (third-party figure)       | $7                                     |
| GitHub              | Repo free; 2,000 Actions min for private repos (none used)                       | Not reached                                                                            | None needed                                   | $0                                     |
| Razorpay            | Test mode: no money moves, no fee                                                | Not reached in test mode                                                               | Live mode after the clinic's own KYC          | 2% + 18% GST per payment, no fixed fee |
| Phone (optional)    | None configured; Twilio cannot place +91 to +91 calls                            | Needs an Indian provider before any real call                                          | Plivo India, INR 0.38/min + INR 200 number    | about INR 430 (unverified for SIP)     |
| SMS (optional)      | None; DLT registration required                                                  | Needs DLT first                                                                        | MSG91-type provider, INR 0.25/SMS             | about INR 150 + one-time INR 5,900     |
| WhatsApp (optional) | None; free replies inside the 24-hour window                                     | Needs a Business Platform account and approved templates                               | Direct or via a partner                       | about INR 100-750 + partner fee        |

### Estimated monthly budget for a small paid client (500 leads, 200 assistant calls)

| Item                                    | Monthly                                      |
| --------------------------------------- | -------------------------------------------- |
| Netlify Personal                        | $9                                           |
| Supabase Pro                            | $25                                          |
| Resend Pro                              | $20                                          |
| LiveKit Ship + Inference overage        | about $61                                    |
| Gemini paid tier                        | under $1                                     |
| Render Starter                          | $7                                           |
| GitHub                                  | $0                                           |
| **Core total**                          | **about $123 a month**                       |
| Optional: phone calls (Plivo)           | about INR 430                                |
| Optional: SMS and WhatsApp              | about INR 250-900                            |
| Per payment: Razorpay                   | 2% + GST on the fee                          |
| One-time: DLT registration, domain name | about INR 5,900 + domain (domain not priced) |

The core total drops to about $111 a month if Rime Coda speech stays free on LiveKit. The two items that matter most for
the budget are LiveKit (half the total) and the move off free tiers for Supabase and Gemini, which is about reliability
and privacy rather than volume.
