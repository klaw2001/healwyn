# Deploy on free tiers

The exact steps to run the whole system on free plans: Supabase (database and staff sign-in data), two Netlify sites
(the website and the CRM), Resend (email), LiveKit Cloud and Google Gemini (the assistant), Render (the assistant's text
service) and Razorpay in test mode. Limits and upgrade costs are in `docs/FREE_TIER_REPORT.md`.

Order matters: database first, then the CRM (its URL is needed elsewhere), then the website, then the assistant.

## 0. Before you start

- A GitHub repository with this code, and accounts on Supabase, Netlify, Resend, LiveKit Cloud, Google AI Studio and
  Render (optional: Razorpay, for its test mode).
- Locally: Node 22+, pnpm 10, and Python 3.13 for the assistant.
- Generate secrets with `openssl rand -base64 48` (one each): `SESSION_SECRET`, `CRON_SECRET`, `UNSUBSCRIBE_SECRET`,
  `INBOUND_WEBHOOK_SECRET`, `VOICE_WEBHOOK_SECRET`, `VOICE_AGENT_SECRET`, `RATE_LIMIT_SALT`. Keep them out of the
  repository: they go only into the hosting dashboards and your local `.env`.

## 1. Database (Supabase Free)

1. Create a project. Pick the region closest to your users (for India, Mumbai). Note the project ref.
2. Apply the migrations from your machine: put the **Session pooler** connection string in `DATABASE_URL` (Dashboard >
   Connect; the direct host is IPv6-only on the free plan) and run `pnpm db:migrate`. Without a direct connection, set
   `SUPABASE_ACCESS_TOKEN` and `SUPABASE_URL` instead and run the same command (it goes through the Management API).
   Never run `packages/db/supabase/local-shim.sql` against Supabase.
3. Seed the demo data (synthetic staff, calendars and 40 demo leads per industry): `pnpm db:seed`. Set
   `DEMO_USER_PASSWORD` first if you do not want the default demo password.
4. Create the least-privilege login roles in the SQL editor (choose strong passwords):

   ```sql
   create role healwyn_web login password '…';
   grant web_submitter to healwyn_web;

   create role healwyn_crm login password '…';
   grant crm_server to healwyn_crm;
   grant authenticated to healwyn_crm;
   ```

   The website's role can only call its own functions (submit an enquiry, unsubscribe, its booking, payment and call
   functions). The CRM's role signs staff in and then acts as the signed-in staff member under row level security.

5. Build the two connection strings through the **transaction pooler** (port 6543), with users `healwyn_web.<ref>` and
   `healwyn_crm.<ref>`. Netlify functions cannot reach the IPv6-only direct host.

## 2. The CRM (Netlify site 1)

1. New site from the repository. Base directory: empty. **Package directory: `/apps/crm`** (`apps/crm/netlify.toml`
   supplies the build command, the publish directory and the scheduled function).
2. Environment variables:

   | Variable                       | Value                                                                                          |
   | ------------------------------ | ---------------------------------------------------------------------------------------------- |
   | `CRM_DATABASE_URL`             | the `healwyn_crm` transaction-pooler string                                                    |
   | `SESSION_SECRET`               | a random secret                                                                                |
   | `CRON_SECRET`                  | a random secret (the scheduled function sends it)                                              |
   | `UNSUBSCRIBE_SECRET`           | a random secret, **the same on the website** (it signs unsubscribe, booking and payment links) |
   | `INBOUND_WEBHOOK_SECRET`       | a random secret (signed reply webhook)                                                         |
   | `VOICE_WEBHOOK_SECRET`         | a random secret, also given to the assistant                                                   |
   | `VOICE_AGENT_SECRET`           | a random secret, also given to the text service                                                |
   | `VOICE_TEXT_URL`               | the Render URL from step 5                                                                     |
   | `SITE_URL`                     | the website's URL (step 3)                                                                     |
   | `CRM_URL`                      | this site's URL                                                                                |
   | `RESEND_API_KEY`, `EMAIL_FROM` | from Resend (step 4)                                                                           |
   | `INDUSTRY`                     | the default industry for the sign-in page (`clinic`, `real_estate`, …)                         |
   | `AUTH_PROVIDER`                | `local` (staff passwords from the seed)                                                        |

   Demo deployments only: `DEMO_LOGIN=true` (one-click demo users on the sign-in page) and `DEMO_MODE=true` (the demo
   bar). The bar's **Reset demo** button also needs `DATABASE_URL` (the owner connection, pooler string); without it
   the button says to run `pnpm demo:reset` instead. Never set any of these three on a deployment with real data.

3. Deploy, then open `/login`. The scheduled function `nurture-cron` calls `/api/cron/nurture` every five minutes.

## 3. The website (Netlify site 2)

1. New site from the same repository. **Package directory: `/apps/web`**.
2. Environment variables:

   | Variable                                               | Value                                                   |
   | ------------------------------------------------------ | ------------------------------------------------------- |
   | `WEB_DATABASE_URL`                                     | the `healwyn_web` transaction-pooler string             |
   | `LEAD_STORE`                                           | `postgres`                                              |
   | `RATE_LIMIT_SALT`                                      | a random secret                                         |
   | `UNSUBSCRIBE_SECRET`                                   | the same value as the CRM                               |
   | `SITE_URL`                                             | this site's URL                                         |
   | `CRM_URL`                                              | the CRM's URL (demo bar links)                          |
   | `INDUSTRY`                                             | which industry the site shows                           |
   | `RESEND_API_KEY`, `LEAD_NOTIFY_EMAIL`, `EMAIL_FROM`    | new-enquiry notifications (optional)                    |
   | `VOICE_TEXT_URL`, `VOICE_AGENT_SECRET`                 | the text service (step 5)                               |
   | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | browser voice (step 5); leave empty for typed chat only |

   Demo deployments: `DEMO_MODE=true`. The website's pages are generated at build time, so changing `DEMO_MODE` or
   `INDUSTRY` needs a new deploy ("Clear cache and deploy").

3. Deploy. Use deploy previews while iterating: each production deploy of either site uses 15 of the free plan's 300
   monthly credits.

## 4. Email (Resend Free)

Create an API key. Without a verified domain, Resend delivers only to your own sign-up address, which is enough for a
demo. For real recipients, verify a domain (DNS records) and set `EMAIL_FROM` to an address on it. Unsubscribe links
and the one-click `List-Unsubscribe` header are built in.

## 5. The assistant (LiveKit Cloud, Gemini, Render)

Follow `docs/VOICE.md` ("Deploy"). In short:

1. **Gemini:** create an API key in Google AI Studio (`GEMINI_API_KEY`). The model only maps answers to allowed options.
   The free tier lets Google use the text; for real people's data use the paid tier.
2. **Text service** (typed chat and the CRM's simulated calls): a Render free web service from this repository running
   `bash scripts/voice.sh run python -m healwyn_voice.server`, with `VOICE_AGENT_SECRET`, `VOICE_WEBHOOK_SECRET`,
   `CRM_URL` and `GEMINI_API_KEY`. It sleeps after 15 minutes idle; the first chat after that waits about a minute.
3. **Voice agent** (optional, browser voice): deploy `healwyn_voice.agent` to LiveKit Cloud with the same secrets and
   `LIVEKIT_*`. The free plan's monthly credit covers only a small number of calls.

## 6. Payments (Razorpay test mode, optional)

Without keys, the website uses its simulated checkout, which goes through the same signed webhook handling. To use
Razorpay's real test mode:

1. In the Razorpay dashboard, switch to **Test mode** and create API keys (`rzp_test_…`).
2. On the website: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
3. Add a webhook to `<SITE_URL>/api/payments/razorpay` for `payment.authorized`, `payment.captured`, `payment.failed`
   and `order.paid`, with a secret, and set it as `RAZORPAY_WEBHOOK_SECRET`.

Live keys (`rzp_live_…`) are refused: both apps fail to start with them.

## 7. After deploying

- Website: send an enquiry, choose a time on the thank-you panel, make a test payment.
- CRM: sign in as the front desk, find the enquiry, run a simulated assistant call, check the booking and payment.
- Sign in as the manager and open the dashboard.
- Check the build logs for "Client bundle check passed" (no server secret reached the browser bundle).
- Keep an eye on the Netlify credit meter and the LiveKit usage page in the first week.

## Turning a demo into a pilot

Unset `DEMO_LOGIN`, `DEMO_MODE` and the CRM's `DATABASE_URL`; replace the demo staff with real accounts; set
`ALLOW_INDEXING=true` only when the brand is real; move Gemini to the paid tier; verify an email domain; and read the
"before a real client" list in `NEXT.md`.
