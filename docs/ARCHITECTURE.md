# Architecture

This document is the "how data moves" map of the app. If you've just landed
in the codebase, read this before editing anything that talks to the network.

## TL;DR

- **Google Sheet is the single source of truth.** Everything the app shows
  and every write the app makes goes through the sheet (either directly via
  the Google Sheets API, or via a small Express layer in dev). There is no
  database server.
- **One set of API handlers, two runtimes.** `api/*.js` are Vercel serverless
  functions. The local Express dev server (`server/index.js`) mounts the
  exact same handlers so behavior matches production.
- **Clients are API-first.** The browser talks to `/api/*` and never loads
  static JSON at runtime. The sheet can be re-exported to
  `public/data/database.json` for backups, but the app itself doesn't use it.

## Runtime flow

```
                    ┌────────────────────┐
                    │   Google Sheet     │   (source of truth)
                    └─────────┬──────────┘
                              │
           ┌──────────────────┴──────────────────┐
           │                                     │
   GOOGLE_SHEETS_API_KEY                GOOGLE_SERVICE_ACCOUNT_KEY
     (reads only)                     (reads + writes)
           │                                     │
           ▼                                     ▼
     ┌────────────────────────────────────────────────────┐
     │       API handlers (api/*.js, plain Node)          │
     │   database · profile · rsvps · checkins ·          │
     │   suggestions · member-register · member-login ·   │
     │   events/*                                         │
     └─────────┬───────────────────────┬──────────────────┘
               │                       │
         Vercel (prod)          Express (local dev)
               │                       │
               ▼                       ▼
          https://map.   …   http://localhost:3001/api/*
               │                       │
               └───────────┬───────────┘
                           │
                           ▼
                  ┌──────────────────────┐
                  │  React SPA (Vite)    │
                  │  src/services/*.ts   │
                  │  src/pages, etc.     │
                  └──────────────────────┘
```

`pnpm dev` selects `server/index.js` (sheet-backed) when credentials are
present, or `server/index.mock.js` (file-backed) otherwise. The selection
lives in `scripts/start-dev.js`.

## Client data layer

All client-to-server traffic is funnelled through `src/services/*.ts`:

| File | Responsibility |
|---|---|
| `api-base.ts` | Resolves `/api` base URL (respects `VITE_API_ORIGIN` for cross-origin partner deploys). |
| `database.ts` | GET `/api/database` — people, travel, RSVPs, events. In-memory cache with in-flight dedupe; writes invalidate it. |
| `rsvp.ts` | GET/POST `/api/rsvps` with localStorage buffer for offline. |
| `checkin.ts` | GET/POST `/api/checkins` with localStorage buffer. |
| `memberAuth.ts` | POST `/api/member-login` → session token stored in `services/identity.ts`. |
| `sync.ts` | Cross-tab + focus coordination (see below). |

### Caching strategy

- `database.ts` keeps one in-memory copy of the full database response
  (`cachedDatabase`). Multiple concurrent callers share one in-flight fetch
  via `inFlightFetch` — no duplicate network requests.
- Writers (`updatePerson`, `createPerson`, `setRSVP`, `checkIn`) all end with
  a `publishDataChanged(scope)` call, which invalidates caches and broadcasts
  to every other tab.
- On returning focus after a tab was hidden for more than one minute, the
  sync module publishes `reason: "focus"` so stale screens auto-refresh.

### Sync module (`src/services/sync.ts`)

Single coordination point for:

1. **Cross-tab writes.** `publishDataChanged("people" | "rsvps" | …)` fires
   locally and on a `BroadcastChannel`. Every other open tab gets a
   `reason: "remote"` message and refetches the relevant data.
2. **Focus refresh.** `visibilitychange` / `focus` listeners detect when the
   tab has been idle and emit a soft refresh.
3. **Error surfacing.** `reportSyncError` replaces the old "return null,
   swallow error" pattern. The root `App.tsx` subscribes and shows a
   rate-limited toast so users know when the server is unreachable.

No extra libraries — just `BroadcastChannel`, `visibilitychange`, and
`focus` events. If you need to add a new scope, extend `DataScope` in
`sync.ts` and call `publishDataChanged(...)` from the write path.

## RSVP semantics (append-only)

The RSVPs sheet is append-only. The current state of each
`(eventId, personId)` pair is the latest row by `updatedAt`.

Statuses:

- `going` — confirmed attending.
- `interested` — might attend.
- `not-going` — explicit "Can't go".
- `withdrawn` — user cleared their RSVP. Excluded from all counts and
  treated as "no selection" in the UI. Added so that un-clicking a
  previous RSVP writes a superseding row instead of silently deleting
  locally (which would leave the old "going" row as the latest on the
  sheet, causing the user to still show up as attending from other tabs
  and devices).

When a user POSTs an RSVP update, the server preserves the earliest
`createdAt` across their prior rows for that event — the timestamp stays
"when I first said yes", even after subsequent edits.

## Auth

- Password-based member login (`api/member-login.js`) returns a session
  token. The token is stored in `localStorage` under `foresight_identity`
  (`src/services/identity.ts`). Token TTL is 30 days, refreshed every 6
  hours by `App.tsx`.
- Profile writes require `Authorization: Bearer <token>`. The server
  (`api/profile.js`) verifies the token and writes to the RealData tab.
- Public write endpoints (`/api/rsvps`, `/api/checkins`, `/api/suggestions`)
  can optionally require an `X-Foresight-Write-Secret` header when
  `FORESIGHT_PUBLIC_WRITE_SECRET` is set. Used for light abuse mitigation
  on anonymous writes. See `docs/VERCEL_ENV.md`.

## Environment variables

See `docs/VERCEL_ENV.md` for the full list. The essentials:

| Variable | Purpose |
|---|---|
| `SPREADSHEET_ID` | Which sheet the app reads/writes. Defaults to the Foresight community sheet when unset. |
| `GOOGLE_SHEETS_API_KEY` | Read-only access. Sheet must be shared "Anyone with the link can view". |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Read + write. JSON string of a service account key. Required for profile saves, RSVPs, check-ins. |
| `FORESIGHT_PUBLIC_WRITE_SECRET` | Optional shared secret for public write endpoints. |
| `VITE_FORESIGHT_WRITE_SECRET` | Client-side companion to the above (sent as `X-Foresight-Write-Secret`). |

## When things go wrong

- Profile save returns `"Google Sheets write credentials are not configured"` — set `GOOGLE_SERVICE_ACCOUNT_KEY` in Vercel.
- RSVP button flashes "Saved on this device only" — the POST failed; the
  record is in localStorage and will not sync until network returns.
- `GET /api/checkins` returns 500 — the `CheckIns` tab is missing from the
  sheet. Create it with headers `personId, fullName, nodeSlug, date, type, createdAt, updatedAt`.
- Events show duplicated/legacy entries — the runtime overrides in
  `server/event-corrections.js` filter known legacy IDs. Add new ones
  there if the sheet has stale data you can't clean up immediately.

## Future: if we outgrow the sheet

The data layer is deliberately small and behind the `src/services/*` API.
Migrating to Postgres/Prisma would mean:

1. Replace `api/database.js` + `api/rsvps.js` + `api/checkins.js` + `api/profile.js` with a thin DB-backed version of the same HTTP contracts.
2. Keep the client untouched (it already treats `/api/*` as the boundary).
3. Drop `server/sheet-database.js`, `scripts/sync-events.js`, and the
   `event-corrections.js` workarounds.

Until the community outgrows the sheet (thousands of rows, concurrent
writes, row-level access control), the current setup is intentionally
minimal.
