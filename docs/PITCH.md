# Five-minute demo

A live demo script for showing the platform to a prospect, with a talk track for each of the four industries and
honest answers to the questions people usually ask. Everything shown is a demo: fictional brands, synthetic data, test
payments.

## Before the call (ten minutes)

1. **Environment** (root `.env`, then build and start both apps):
   - `DEMO_MODE=true` (the demo bar on both apps; set it before `pnpm build`, the website's pages are static).
   - `DEMO_LOGIN=true` (one-click demo users on the CRM sign-in page). Turn it off again after the demo.
   - `INDUSTRY=` the prospect's industry (`clinic`, `real_estate`, `wealth_advisory` or `home_interiors`).
   - `SITE_URL` and `CRM_URL` pointing at the two apps, so the demo bar's links work.
2. **Fresh data:** `pnpm demo:reset all`. This restores every industry's 40 demo leads, staff and calendars, removes
   demo enquiries from earlier rehearsals and clears rate limits. Real leads are never touched.
3. **Tabs**, in this order: the website home page; the CRM sign-in page (`/login?industry=…`); a second CRM tab signed
   in as the manager (for the dashboard).
4. **Check the assistant:** open "Talk to our assistant" once. Typed chat works on any network. Browser voice needs a
   microphone and a network that allows WebRTC; if either is doubtful, plan to use typed chat.
5. **Have the backup ready:** the 90-second recording from `docs/WALKTHROUGH_SCRIPT.md`, open in a tab.

If anything fails during the call, say so plainly, switch to the recording, and carry on talking over it.

## The script (5:00)

Times are cumulative. Words in quotes are a suggestion, not a script to read.

### 0:00 to 0:30: the problem

On the website home page.

> "When someone sends an enquiry to a business like yours, three things usually go wrong: nobody replies quickly, it
> lands with whoever is free rather than the right person, and follow-ups depend on someone remembering. This is a
> working demo of a system that handles the whole path, from the first enquiry to a booked, paid appointment."

Point at the demo bar: "Everything you see is a fictional brand with made-up data."

### 0:30 to 1:30: the enquiry and the assistant

Go to **Contact**. Fill in the form (any name, a `70000 …` mobile number, pick a service, tick the first consent).

> "Two separate consents, each stored with the exact wording the person saw. Withdrawing the main one erases their
> details."

Send it. On the thank-you panel, open **Talk to our assistant** (or the button on the home page) and answer three or
four questions in typed chat.

> "It tells people it is an AI, asks permission first, and asks the same questions a good front desk would. It cannot
> improvise: every line is written in advance, and the AI model is only used to understand which option someone meant.
> If someone describes an emergency, it stops and tells them to call 112."

Try one advice question to show the refusal (see the industry tracks below for a good example).

### 1:30 to 2:15: booking and a test payment

Back on the thank-you panel, choose **Choose a time for your …**.

> "These are real slots from the expert's calendar. Two people cannot book the same time: the database itself refuses
> it."

Pick a day and a time and book it. Then choose **Pay online (test payment)**, pick an item, and press **Pay … (test
payment)** on the simulated checkout.

> "This is test mode. With Razorpay test keys, the real Razorpay window opens here; without them, the demo uses a
> simulated checkout that sends the same signed payment event."

### 2:15 to 3:45: the CRM

Switch to the CRM tab. Sign in as the **front desk** user (the coordinator role) from the demo list.

- **Pipeline:** "Here is the enquiry we just sent, already in the paid stage, with its SLA timer and score."
- Open the lead. Walk down the page:
  - **Assistant summary**: "What the assistant learnt, in plain words, with any safety flags."
  - **Routing suggestion** (on other new leads): "It suggests the right person and shows its reasons: language,
    seniority, spare capacity, whether they saw this person before."
  - **Booking panel**: the appointment you just made. "Staff can move or cancel it here too."
  - **Payments (test mode)**: the paid test payment, and "Copy test payment link" for leads who have not paid.
  - **Timeline**: "Every step is recorded: stage changes, messages, the booking, the payment."
- **Bookings** in the menu: "Each expert's week. If someone does not turn up, the system marks them missed two hours
  later and starts a gentle follow-up."

### 3:45 to 4:30: the manager's view

Switch to the manager tab and open **Dashboard**.

> "Every number here is a query over the data, documented line by line: the funnel and where people drop out, how fast
> the team replies against the target, no-shows, each person's load, and what happened on the assistant's calls."

Change the date range once to show it is live.

### 4:30 to 5:00: the multiplier

Click another industry in the demo bar (on the website).

> "The same system, re-skinned in one click: different brand, questions, stages, follow-up messages, safety rules and
> assistant script. Setting up a new industry is writing one configuration file, not rebuilding the product."

Close with the question that matters to them: "Which part of this would save your team the most time?"

## Talk tracks by industry

Use the matching industry for the whole demo; mention the others only in the last 30 seconds.

### Clinic: Healwyn Clinics

- **Lead with safety.** The assistant never gives medical advice. Try: "Should I take paracetamol for this?" It
  declines and offers a callback. Mention that a red-flag symptom (for example chest pain or trouble breathing) ends the
  questions and tells the caller to call 112.
- **The right doctor's team:** routing by specialty, language and the doctor's capacity; returning patients go back to
  the doctor who saw them.
- **Insurance and billing:** answering "yes" to the insurance question copies in the insurance and billing desk.
- **Booking noun:** a consultation. **Paid stage:** Package active.

### Real estate: Nestwyn Realty

- **Site visits:** the booking is a site visit with a property advisor, Tuesday to Sunday.
- **Regulatory notice:** every page carries a regulatory-style notice (no listing is a real project; check
  registrations yourself). Point at the footer.
- **No property advice:** try "Will prices go up in this area?" The assistant declines and offers a property advisor's
  call.
- **Token payment:** a test token moves the lead to Token paid.
- **Home loans:** answering "yes" to the home-loan question copies in the home-loan and payments desk.

### Wealth advisory: Ledgerwyn Wealth

- **Never investment advice:** try "Which mutual fund should I buy?" The assistant declines and says a registered advisor
  can talk it through. Its evaluation fails if any line names a product, a percentage or a market prediction.
- **Fraud red flags:** if a caller says someone is asking for their OTP or PIN, or describes a "digital arrest" call, the
  assistant stops, tells them to hang up on that caller and call 1930 (cyber crime helpline) or their bank.
- **Regulatory notice** in the footer, like real estate.
- **Advisory meeting** at the office or by video; **paid stage:** Plan started.

### Home interiors: Loomwyn Interiors

- **Design consultation**, then site measurement, a shared design and a confirmed design (the paid stage).
- **Safety for homes:** a gas smell, sparks, water near wiring or a cracking ceiling stops the questions and tells the
  caller to leave the area and call 112. The assistant does not give structural or electrical advice.
- **Instalments:** answering "yes" to paying in instalments copies in the accounts desk.

## Questions prospects ask

**What does it cost to run?**
On free tiers, nothing, for a demo. For a small paid client (about 500 leads and 200 assistant calls a month), the
estimate in `docs/FREE_TIER_REPORT.md` is about USD 123 a month for the core services, plus Razorpay's per-payment fee
on live payments. Phone calls, SMS and WhatsApp are extra and priced in that report.

**Where does it break first on the free tiers?**
Voice. LiveKit's free plan has a small monthly credit; depending on the voice used, it covers roughly 30 to 200 short
calls a month. Typed chat keeps working. Hosting credits on Netlify's free plan are the next limit.

**Is our data safe? What about India's DPDP rules?**
Each consent is separate, versioned and stored with a hash of the exact wording. Withdrawing the main consent erases the
person's details. Staff only see the leads their role allows (enforced in the database, not just the screens). The audit
trail holds ids and codes, never names or free text. Logs never contain names, numbers or messages.

**Can the AI say something wrong or harmful?**
It cannot invent sentences: every line it speaks is written in advance. The model only maps an answer to one of the
allowed options, and its output is checked. Safety checks (emergencies, advice requests, attempts to manipulate it) run
before anything else on every turn. A scripted evaluation of 233 conversations across the four industries runs before
every release, and every safety scenario must pass.

**Can it call real phone numbers?**
Not in this demo. The browser voice and the CRM's simulated dialer show the conversation. Real calls need a telephone
provider (a SIP trunk) connected to LiveKit; for India that means an Indian provider and India's telecom rules for
consent and caller IDs.

**Does it send WhatsApp and SMS?**
Email is real. SMS and WhatsApp are simulated: they are recorded, not sent. Real SMS in India needs sender registration
(DLT); WhatsApp needs a Business Platform account. Both slot into the same sequences.

**Which languages?**
English and Hindi (Devanagari and romanised Hinglish) in the assistant; the website and CRM are in English.

**How long to set up our industry?**
The system is configured by one "industry pack": questions, stages, messages, routing, assistant script and safety
rules. The three non-clinic packs in this demo were each written as one pack. A real client's pack needs their real
questions, team and wording, plus review of the safety rules with someone from their field.

**Can it work with our existing CRM?**
Not out of the box. It has its own CRM because the routing, booking and audit trail depend on it. Exporting leads or
sending events to another system is a well-defined addition, not a rebuild.

**Who owns the data, and where is it hosted?**
In a client version, the client's own accounts: their database (Supabase, with an India or nearby region chosen at
setup), their hosting and their email domain.

**What is real and what is simulated?**
Real: the website, forms, consents, CRM, permissions, routing, email follow-ups, booking with no double booking, the
assistant's typed chat and browser voice, test payments through Razorpay's test mode (when keys are set), and the
dashboard. Simulated: SMS, WhatsApp, phone calls, and the checkout when no Razorpay test keys are configured.

**Can staff override the routing?**
Yes. The front desk can accept the suggestion or assign someone else, and must pick a reason; both are recorded.

**What happens when someone does not turn up?**
Staff mark the appointment attended or missed. If nobody does, it is marked missed two hours after it ends, and a short
recovery sequence starts.

**Is it accessible?**
Built to WCAG AA: keyboard use throughout, labelled fields with linked error messages, visible focus, and colour
contrast tested automatically for every industry theme in light and dark mode.

**How is it tested?**
Around 600 unit and database tests, browser tests of the main journeys, and the assistant's scripted evaluation. All of
them run before any change is committed.

**What would you change before a real launch?**
See the prioritised list in `NEXT.md`: real phone and messaging providers, a security review by a third party, load
testing, the client's own content and legal review, and monitoring.
