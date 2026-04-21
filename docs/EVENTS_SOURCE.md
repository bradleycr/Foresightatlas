# Where event data comes from

Events on the **Berlin** and **SF Programming** pages come from one of two places, in this order:

## 1. `public/data/events.json` (preferred on deploy)

- **Built at deploy time** by the sync script: Google Sheet **"Events"** tab + **Luma** API are merged and written to `public/data/events.json`.
- If this file exists and has events, the app uses it. So the **“weekly coworking luncheon session”** (or “Weekly Coworking Lunch & Session”) you see on the live site can be:
  - **From Luma** — if the event is on your Luma calendar, the sync pulls it (title, description, times, link). The card will show a **“View on Luma”** button and, by default, only a short teaser in-app.
  - **From the Google Sheet** — if you have an **Events** tab in the [Foresight Map spreadsheet](https://docs.google.com/spreadsheets/d/1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ/edit), rows there are included. You can set `title`, `description`, `location`, `startAt`, `endAt`, `type`, `externalLink`, etc.

**How to update (when using events.json):**

- **Luma:** Edit the event on [Luma](https://lu.ma) (title, description, etc.). Next deploy will pull the new data.
- **Sheet:** Edit the **Events** tab in the spreadsheet. Use the columns in `docs/LUMA_INTEGRATION.md` (id, nodeSlug, title, description, startAt, endAt, type, externalLink, …). Next deploy (or running `pnpm sync:events` locally) regenerates `events.json`.

## 2. Seed data in code (fallback)

- If `public/data/events.json` is **missing or empty** (e.g. no sync run, or first load), the app uses **hardcoded seed events** in **`src/data/events.ts`**.
- That includes Berlin’s **“Weekly Coworking Lunch & Session”** (Thursdays 12–16h from April 2026), Open Houses, Node Launch, the **Secure & Sovereign AI Workshop** (Jul 18–19, 2026), and SF’s monthly demo days.
- To change titles, descriptions, or add/remove these, edit **`src/data/events.ts`** and redeploy.

**Summary**

| You see…                    | Likely source              | How to update                                                                 |
|----------------------------|----------------------------|-------------------------------------------------------------------------------|
| “Weekly coworking…” on live | Luma or Sheet → events.json | Edit event on Luma or the Sheet **Events** tab, then redeploy / run sync       |
| Same, but no sync / new app | Seed in `src/data/events.ts` | Edit `src/data/events.ts` (e.g. `berlinWeeklyCoworking()`) and redeploy        |

## “Read more” and description

- If the event has an **external link** (e.g. Luma), the card shows a short **teaser** and a **“View on Luma”** (or “Get tickets”) button. The app now also shows the **full description** in the card with a **“Read more”** control when the description is long, so you don’t have to leave the site to see the rest.
- If the event has **no** external link (e.g. seed coworking events), the full description is shown in the card with **“Read more”** when it’s long enough to be truncated.

So: **to update the “weekly coworking luncheon session”** — edit it in **Luma** or in the **Events** tab of the Google Sheet (if you use it), then redeploy; or, if you’re using only seed data, edit **`src/data/events.ts`**.
