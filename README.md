# The Foresight Atlas

**Internal tool** — connecting grantees, fellows, nodees, and our programming. A web app for visualizing where Foresight Institute grantees, fellows, and prize winners are located, where they are traveling, and what’s on at each node.

**Open source (MIT)** — Issues and pull requests are welcome. New here? Read **[CONTRIBUTING.md](CONTRIBUTING.md)**, the **[documentation index](docs/README.md)**, and **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)**. Security-sensitive reports: **[.github/SECURITY.md](.github/SECURITY.md)** (do not use public issues for undisclosed vulnerabilities).

## What it does

The app includes:

- **Map** — Interactive world map with **one marker per person** at their profile location; search and filters; open people from the map or the list. Travel and RSVPs appear on cards as context (they do not add extra pins).
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

This app is **Vite + React** (not Next.js). [vercel.json](vercel.json) sets the build (`pnpm run build`), output directory (`dist`), install command, and SPA rewrites for client-side routes.

1. Import the repo in [vercel.com](https://vercel.com) → **Add New Project** (or use the [Vercel CLI](docs/VERCEL_CLI.md): `pnpm run vercel:link`).
2. **Environment variables** for production: at minimum **SPREADSHEET_ID** and **GOOGLE_SERVICE_ACCOUNT_KEY** so the map loads and profiles/RSVPs/check-ins can write to the sheet. See [docs/VERCEL_ENV.md](docs/VERCEL_ENV.md). Quick status check: `pnpm run vercel:status` (after linking).

**GitHub Pages:** An optional manual workflow is in [DEPLOYMENT.md](DEPLOYMENT.md). The primary production deploy for this project is Vercel.

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

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for setup (including **running without Google credentials** via the local mock API), branch/PR expectations, and where to ask questions. Use **Issues** for bugs and **Discussions** for open-ended topics when enabled. Before a release, maintainers use [docs/MANUAL_UX_CHECKLIST.md](docs/MANUAL_UX_CHECKLIST.md) as a smoke-test list.

By contributing, you agree that your contributions are licensed under the **same license as the project** ([LICENSE](LICENSE) — MIT).

## License

MIT License. Copyright (c) 2025–2026 Foresight Institute. See [LICENSE](LICENSE).
