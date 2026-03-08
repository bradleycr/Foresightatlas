# Luma + Google Sheet Events Integration

Events on the Programming pages come from **two sources**, merged at build time:

1. **Google Sheet "Events" tab** — for manual / internal entries you manage yourself  
2. **Luma API** — pulls public events from [luma.com/foresightinstitute](https://luma.com/foresightinstitute)

If the same event exists in both (linked via `lumaEventId`), Luma data wins for title, description, times, location, and link. No duplicates.

**Where does the data actually come from?** See [docs/EVENTS_SOURCE.md](EVENTS_SOURCE.md) for the full picture (including fallback seed data in code).

---

## How it works

```
pnpm sync:events
```

This runs `scripts/sync-events.js` which:

1. Fetches the **Events** tab from your Google Sheet
2. Fetches all events from **Luma** via their API
3. Merges and deduplicates them
4. Writes `public/data/events.json`

The app loads `events.json` at runtime. If the file doesn't exist, it falls back to the hardcoded seed events in `src/data/events.ts`.

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

## Luma API reference

- [Getting Started](https://docs.luma.com/reference/getting-started-with-your-api)
- [List Events](https://docs.luma.com/reference/get_v1-calendar-list-events) — `GET /v1/calendar/list-events`
- Base URL: `https://public-api.luma.com`
- Auth header: `x-luma-api-key: YOUR_KEY`
