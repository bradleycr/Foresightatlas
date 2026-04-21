# Grantees and Fellows Map and Programming

A web app for visualizing where Foresight Institute grantees, fellows, and prize winners are located and where they are traveling. Built for the Foresight community to see who is where and when.

**Open source** — Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and the [documentation index](docs/README.md).

## What it does

The app includes:

- **Map** — Interactive world map with markers for current location and travel. Click markers to see who is at each place.
- **Programming** — Per-node event calendars (e.g. Berlin, San Francisco) with RSVPs and check-ins where configured.
- **Calendar** — Signed-in members get a large shared-node calendar view powered by React Big Calendar and `/api/calendar-events` (Google Calendar with mock fallback).
- **Timeline** — Tab exists in the UI; full timeline experience is still **coming soon** (see [AGENTS.md](AGENTS.md)).

Anyone can browse, filter by program type, focus area, or location, and suggest location updates through a public form. Maintainers review suggestions in the Google Sheet.

## Running it locally

You need **Node.js** (20+ recommended) and **pnpm**.

**Environment:** Copy `.env.example` to `.env.local` and set sheet credentials. The app **requires** the API and Google Sheet — there is no static `database.json` at runtime. Without credentials, `GET /api/database` will fail.

```bash
pnpm install

# Frontend (Vite, port 3000) + API (Express, port 3001); /api is proxied
pnpm dev

# API only (port 3001)
pnpm dev:api

# Frontend + API + optional Signal check-in poller (if Signal env vars are set)
pnpm dev:all
```

Open **http://localhost:3000**. Data is loaded from the Google Sheet via the API. Setup details: [docs/SHEETS_SYNC.md](docs/SHEETS_SYNC.md) and [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

If no Google credentials are configured, local dev falls back to a file-backed mock backend (no external services):
- `mock/database.local.json` (main database)
- `mock/auth.local.json` (directory auth/password state)
- `mock/luma-events.local.json` (seeded with at least 2 mock Luma events)

Split server entrypoints:
- `server/index.js` = sheet-backed Express API
- `server/index.mock.js` = file-backed local mock API
- `pnpm dev` auto-selects the entrypoint based on credentials

## Deploy on Vercel

This app is **Vite + React** (not Next.js). Vercel supports it out of the box.

1. Import the repo in [vercel.com](https://vercel.com) → **Add New Project**.
2. **Build:** defaults plus `vercel.json` (may run sheet sync before `pnpm run build` — see repo config).
3. **Output directory:** `dist`.
4. **Install:** `pnpm install`.
5. **Environment variables** for live data: `GOOGLE_SHEETS_API_KEY` or `GOOGLE_SERVICE_ACCOUNT_KEY`, and optionally `SPREADSHEET_ID`. Profile save and writes need the service account — see [docs/VERCEL_ENV.md](docs/VERCEL_ENV.md).

**GitHub Pages:** An optional manual workflow is described in [DEPLOYMENT.md](DEPLOYMENT.md). Primary deploy is Vercel.

## Tech stack

- React + TypeScript, Vite, Tailwind, shadcn/ui
- React Leaflet for the map
- Express API in development; Vercel serverless handlers under `api/` in production
- **Google Sheet** as source of truth for people, directory auth, events (when using the default backend)
- Google Calendar API for shared node calendars (`/api/calendar-events`)

## Project structure (abbreviated)

```
src/                 # React app (map, programming pages, services)
src/services/        # API clients — database.ts is the main data façade
api/                 # Vercel serverless routes (database, profile, rsvps, …)
server/              # Express app for local dev; sheet + Signal poller
server/signal/       # Signal check-in integration (optional)
scripts/             # Sheet sync, geocoding, tests, one-off maintenance
docs/                # Curated documentation ([index](docs/README.md))
reports/             # Gitignored outputs from audit/compare scripts (see reports/README.md)
```

## Data model (conceptual)

**People** — Grantees, fellows, prize winners: identity, role, cohort, focus areas, location, project copy, node affiliation.

**Travel windows** — Upcoming or current trips with places and dates.

**Location suggestions** — Public submissions; admins handle in the sheet.

**Events & RSVPs** — Programming calendar and attendee state when those tabs/APIs are enabled.

Exact columns are documented in [docs/SHEETS_SYNC.md](docs/SHEETS_SYNC.md) and `scripts/sheet-schema.js`.

## Admin and directory access

There is **no** hardcoded admin user in a JSON file. Admin and directory (member) accounts are **sheet-backed** (e.g. Admin Users and Real Data tabs). See [docs/SHEETS_SYNC.md](docs/SHEETS_SYNC.md).

## Backend integration and partner deployments

The default stack reads and writes the Google Sheet through `/api/*`. All frontend data access goes through `src/services/database.ts` and related service modules, so you can:

- Keep this repo as the **UI shell** and point it at another origin that implements the same JSON shapes and routes (see [src/INTEGRATION.md](src/INTEGRATION.md)).
- Or replace the server layer while preserving the React app.

Optional **cross-origin API:** set `VITE_API_ORIGIN` at build time so the static app calls `https://your-api-host` instead of same-origin `/api` (CORS must be allowed on the API).

## Optional: Signal check-in bot

The Signal integration is **optional**. If you are helping finish or operate the bot, start with [docs/SIGNAL_CHECKIN_SETUP.md](docs/SIGNAL_CHECKIN_SETUP.md) and `server/signal/`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Before a release, [docs/MANUAL_UX_CHECKLIST.md](docs/MANUAL_UX_CHECKLIST.md) is a practical smoke-test list.

## License

MIT License. Copyright (c) 2025–2026 Foresight Institute. See [LICENSE](LICENSE).
