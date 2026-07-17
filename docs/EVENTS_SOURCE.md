# Where event data comes from

Programming pages (Berlin, SF, Global) load events from **GET `/api/database`**. The server merges two sources **live on each request** (with a short Luma cache):

## 1. Google Sheet **Events** tab (manual / internal)

- Your private spreadsheet’s **Events** tab is the place for hand-entered or internal rows.
- Columns: see [LUMA_INTEGRATION.md](LUMA_INTEGRATION.md) and `scripts/sheet-schema.js`.
- Edit the sheet → next API fetch (frontend refresh window ~10 minutes, or focus / reload) shows the change.

## 2. Luma API (public calendar events)

- If `LUMA_API_KEY` is set, the server fetches the Luma calendar and merges **public** events only.
- Luma response is cached ~**10 minutes** server-side.
- If a sheet row has `lumaEventId` matching a Luma `api_id`, Luma wins for title, description, times, location, link, and cover; the sheet can still set `nodeSlug` / type / tags.
- Luma-only public events are appended automatically — **no deploy step** and **no `pnpm sync:events` required**.

Details: [LUMA_INTEGRATION.md](LUMA_INTEGRATION.md).

## 3. In-code seeds (fallback / Berlin coworking)

- If the API/sheet is unavailable or returns no events, the UI falls back to seeds in **`src/data/events.ts`**.
- Berlin **Coworking / Resident’s Day** Thursdays are generated in code and **injected** on the Berlin page even when the API has other Berlin events (they are not published to Luma).

## Optional: `public/data/events.json`

- Built by `pnpm sync:events` (Sheet + Luma → JSON).
- Used only as a **static fallback** when the live API/sheet path is unavailable.
- Not what production Vercel uses day-to-day — the live merge is.

## Freshness (what users feel)

| Layer | Typical freshness |
|-------|-------------------|
| Server Luma fetch | ≤ ~10 minutes |
| Frontend `/api/database` + events cache | ≤ ~10 minutes |
| Focus after idle / 15‑min heartbeat | Immediate re-pull when the tab is active |

So: add a **public** event on the Foresight Luma calendar → it should appear on the programming pages within about 10–15 minutes without a redeploy. Private/unlisted Luma events are intentionally never shown.

## “Read more” and description

- Events with an external link (e.g. Luma) show a teaser plus a CTA; long descriptions get **Read more** in-card.
- Seed / sheet-only events without a link show the full description with the same control when truncated.
