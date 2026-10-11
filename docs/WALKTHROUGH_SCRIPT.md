# 90-second walkthrough (backup recording)

A storyboard for a screen recording to play when a live demo is not possible. It follows the five-minute path in
`docs/PITCH.md`, compressed. Record it once per industry you pitch often, or once with the clinic and mention the
industry switch at the end.

## Before recording

- `pnpm demo:reset all`, then start both apps with `DEMO_MODE=true` and `DEMO_LOGIN=true`.
- Screen 1920 × 1080, browser zoom 110%, bookmarks bar hidden, one clean browser profile with no extensions showing.
- Light theme (it reads better in video), the demo bar visible at the top.
- Prepare the enquiry details in a note so typing is quick: name "Asha Demo", mobile `70000 12345`, a service.
- Sign in to the CRM as the manager in a second window beforehand, so the dashboard shot needs no login.
- Record the screen first; add the voice-over and captions afterwards. Keep the cursor still between actions.
- No real names, numbers or emails anywhere on screen.

## Shot list (90 seconds)

| #   | Time      | Screen                        | Action                                                                 | On-screen caption                              | Voice-over                                                                                                                          |
| --- | --------- | ----------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0:00–0:07 | Website home                  | Hold on the hero; slow scroll to the services                          | A lead-to-expert platform (demo)               | "Enquiries get lost between the website and the right expert. This demo closes that gap."                                           |
| 2   | 0:07–0:17 | `/contact`                    | Fill the form, tick the first consent, send                            | Separate, versioned consents                   | "Someone sends an enquiry. Each consent is stored with the exact wording they saw."                                                 |
| 3   | 0:17–0:30 | Assistant dialog (typed chat) | Answer two questions; ask one advice question; show the polite refusal | The AI says it is an AI. It never gives advice | "An AI assistant asks a few short questions. Every line is scripted, and it never gives advice."                                    |
| 4   | 0:30–0:40 | `/book`                       | Pick a day and a time; book                                            | Real slots. No double booking.                 | "They choose a real time from the expert's calendar. The database refuses double bookings."                                         |
| 5   | 0:40–0:47 | `/pay`                        | Choose an item; press Pay on the simulated checkout; success message   | Test payment: no real money moves              | "A test payment closes the loop."                                                                                                   |
| 6   | 0:47–1:02 | CRM pipeline, then the lead   | Click the new lead; scroll past summary, routing, booking and payments | Summary, routing reasons, booking, payment     | "In the CRM, the team sees the lead with the assistant's summary, why it was routed, the booking and the payment, and its history." |
| 7   | 1:02–1:15 | CRM dashboard (manager)       | Hover the funnel; change the date range once                           | Every number is a documented query             | "Managers see the funnel, response times against the target, no-shows and each person's load."                                      |
| 8   | 1:15–1:25 | Website, demo bar             | Click two other industries in turn                                     | One platform, four industries                  | "The same platform re-skins for real estate, wealth advisory or interiors: brand, questions, stages, messages and safety rules."    |
| 9   | 1:25–1:30 | Website home (new industry)   | Hold                                                                   | Demo brand, all content fictional              | "Fictional brands, synthetic data. Ask me for a live walkthrough."                                                                  |

Total: 90 seconds.

## After recording

- Trim dead time between shots; keep each caption on screen for at least two seconds.
- Export at 1080p, under 30 MB, with burnt-in captions (people often watch without sound).
- Check every frame for anything that looks like a real person's details.
- Run `pnpm demo:reset all` again so the next live demo starts clean.
