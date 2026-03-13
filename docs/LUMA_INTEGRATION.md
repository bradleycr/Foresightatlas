# Luma + Google Sheet Events Integration

Events on the Programming pages come from **two sources**, merged **when you load the app**:

1. **Google Sheet "Events" tab** — source of truth for manual / internal entries  
2. **Luma API** — fetched live by the server and merged with sheet events on each request (cached 10 minutes)

No manual sync step: **GET /api/database** reads events from the sheet, then merges in Luma events (with a short server-side cache). If the same event exists in both (linked via `lumaEventId`), Luma data wins for title, description, times, location, link, and cover image. No duplicates.

**Where does the data actually come from?** See [docs/EVENTS_SOURCE.md](EVENTS_SOURCE.md) for the full picture (including fallback seed data when the API is unavailable).

---

## How it works (live merge)

When the app loads, it calls **GET /api/database**. The server:

1. Reads the **Events** tab from the Google Sheet (source of truth)
2. Fetches events from **Luma** via their API (cached for 10 minutes to avoid hitting Luma on every request)
3. Merges and deduplicates (Sheet + Luma)
4. Returns the merged list in the database payload

You do **not** need to run `pnpm sync:events` for the app to show Luma events. Optionally, you can still run it to write **public/data/events.json** (used only when the API/sheet is unavailable).

---

## Setup — what you need to do

### 1. Get a Luma API key

Luma API requires **Luma Plus** on the calendar.

1. Go to your Luma calendar's **Settings → Developer**
2. Generate an API key
3. Add it to your `.env.local`:

```
LUMA_API_KEY=your-luma-api-key-here
```

### 2. (Optional) Add the Events tab to your Google Sheet

If you want to add manual events via the sheet:

1. Open the [Foresight Map spreadsheet](https://docs.google.com/spreadsheets/d/1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ/edit)
2. Create a new tab called **Events**
3. Set row 1 headers to:

| id | nodeSlug | title | description | location | startAt | endAt | type | tags | visibility | capacity | externalLink | recurrenceGroupId | lumaEventId |
|----|----------|-------|-------------|----------|---------|-------|------|------|------------|----------|--------------|-------------------|-------------|

- **id** — unique string (e.g. `berlin-workshop-2026-05-15`)
- **nodeSlug** — `berlin`, `sf`, or `global`. **Location overrides:** If **location** is empty, "TBA", "TBD", or "to be announced", the event is always shown on **Global** programming only (not Berlin or SF). Luma events with no address default to global; only events with a node-specific location (or explicitly tagged in the sheet) appear on Berlin/SF.
- **startAt / endAt** — ISO 8601 datetime (e.g. `2026-05-15T14:00:00+02:00`)
- **type** — one of: `coworking`, `workshop`, `conference`, `launch`, `open-house`, `demo`, `social`, `flagship`, `other`
- **tags** — JSON array (e.g. `["ai","workshop"]`)
- **visibility** — `public` or `internal`
- **capacity** — number or leave blank
- **externalLink** — registration URL (e.g. Luma event page, Eventbrite, etc.)
- **lumaEventId** — if this event also exists on Luma, paste the Luma event's `api_id` here. Luma data will then overwrite title/description/times/link.

### 3. Add secrets to your deploy environment

**For GitHub Actions** (GitHub Pages deploy):
- Go to repo Settings → Secrets and variables → Actions
- Add secret: `LUMA_API_KEY`

**For Vercel:**
- Go to Project Settings → Environment Variables
- Add: `LUMA_API_KEY`

The deploy workflow already runs `sync-events.js` before build.

---

## Running locally

```bash
# Sync events (Sheet + Luma) to public/data/events.json
pnpm sync:events

# Sync everything (database + events)
pnpm sync:all

# Then start the dev server
pnpm dev
```

---

## How deduplication works

| Scenario | Result |
|----------|--------|
| Event only in Sheet | Included as-is |
| Event only on Luma | Included with auto-detected node and type |
| Event in both (Sheet row has `lumaEventId` matching Luma `api_id`) | **Luma wins** for title, description, times, location, link. Sheet's `nodeSlug` and `type` are kept if they're set. |

This means you can:
- **Add events to Luma** → they appear automatically on the Programming pages
- **Add events to the Sheet** → they appear even if not on Luma
- **Link Sheet events to Luma** → set `lumaEventId` so Luma keeps the data fresh

---

## Berlin / SF coworking and seed events

**Berlin coworking sessions** (and some other recurring or one-off events) are defined **in code** as seed data in `src/data/events.ts`. They are **not** stored in the Google Sheet by default.

- **If the API returns no events for a node:** the app shows that node’s seed events (e.g. Berlin weekly coworking, SF demo days) so the programming page is never empty.
- **If the API returns events for other nodes but none for Berlin:** the app now **falls back to Berlin seed events** on the Berlin page, so coworking still appears.
- **To make events the single source of truth:** add them to the Sheet **Events** tab (or create them on Luma with a clear Berlin/SF location). Then they come from the API and seed is only used when the API has nothing for that node.

---

## Luma API reference

- [Getting Started](https://docs.luma.com/reference/getting-started-with-your-api)
- [List Events](https://docs.luma.com/reference/get_v1-calendar-list-events) — `GET /v1/calendar/list-events`
- Base URL: `https://public-api.luma.com`
- Auth header: `x-luma-api-key: YOUR_KEY`

Events returned by the API can include a **`cover_url`** (cover image). The sync script passes this through as **`coverImageUrl`**; event cards show the image when present. Cards without a cover render as before (no empty placeholder).
