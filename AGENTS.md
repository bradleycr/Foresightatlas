# AGENTS.md

## Cursor Cloud / AI instructions

### Overview

**Foresight Atlas** — a React + TypeScript SPA (Vite) that visualizes Foresight Institute grantees, fellows, and prize winners on an interactive Leaflet map, plus per-node **Programming** pages (Berlin, SF, Global) for event calendars. **The Google Sheet is the single source of truth.** The app always loads data via the API from the sheet (dev and production). No static `database.json` at runtime.

### Naming and copy

- **App title:** “Foresight Atlas” (with optional “(beta)” marker in the header/footer).
- **Subtext:** “Internal tool — Connecting Grantees, Fellows, Nodees, and our programming”.
- **Nav:** Desktop = “Map” + “Programming” (dropdown: Berlin, San Francisco, Global). Mobile hamburger = “Map”, “Berlin node”, “SF node”, “Global programming”.
- **Footer:** “Foresight Institute · Foresight Atlas · {year}”.

### Services

| Service | Command | Port | Notes |
|---|---|---|---|
| Frontend + API (local dev) | `pnpm dev` | 3000 + 3001 | **Single command:** runs Vite (3000) and Express API (3001). Proxies /api to 3001. Same behavior as production (one host, app + API). |
| API only | `pnpm dev:api` | 3001 | Serves data from the Google Sheet. Use when you only need the API. |
| All (with Signal) | `pnpm dev:all` | 3000 + 3001 + signal | Frontend, API, and Signal check-in poller. |

### Key caveats

- **No linter or test runner configured.** No ESLint, Prettier, or test framework in `package.json`; no `lint` or `test` scripts.
- **Sheet is the only source of truth.** The app always fetches data from GET `/api/database`, which reads from the Google Sheet. Configure **GOOGLE_SHEETS_API_KEY** or **GOOGLE_SERVICE_ACCOUNT_KEY** (and **SPREADSHEET_ID**) so the API and app can load. No static `public/data/database.json` at runtime.
- **Frontend.** `src/services/database.ts` fetches `/api/database` only; no JSON fallback. If the API or sheet is unavailable, the app shows the error from the API.
- **Vercel.** Set **GOOGLE_SERVICE_ACCOUNT_KEY** (and **SPREADSHEET_ID**) in Vercel so the app can load data and users can save profiles. Without it, profile update shows “Google Sheets write credentials are not configured.” See `docs/VERCEL_ENV.md`. Read-only alternative: **GOOGLE_SHEETS_API_KEY** (sheet shared “Anyone with the link can view”); profile save still needs the service account.
- **pnpm build scripts.** `@swc/core` and `esbuild` require approved build scripts via `pnpm.onlyBuiltDependencies` in `package.json`.
- **CSS `@import` warning.** Build may emit a PostCSS warning about `@import` order; cosmetic only.
- **Timeline view.** The Timeline tab exists but is “Coming soon” in the UI.
- **Vite port.** Dev server runs on port **3000** (set in `vite.config.ts`), not Vite’s default 5173.
- **Routes.** `/` = map, `/berlin` = Berlin Programming, `/sf` = SF Programming. Base-path-aware for GitHub Pages.
- **Mobile map behavior.** On mobile, when the filtered marker set is small (≤50), the map fits the view to those markers so users don’t have to pan to find grantees or event RSVPs.
- **Mock strategy (important).** Follow existing config-driven backend injection: `pnpm dev` selects `server/index.js` (sheet-backed) vs `server/index.mock.js` (file-backed) based on credentials in `scripts/start-dev.js`. Frontend services should stay API-first and should not add separate frontend-only mock toggles for core data flows.
- **Google Sheets.** Source of truth for people and directory auth. See `docs/SHEETS_SYNC.md`.
  - **Runtime:** GET `/api/database` and directory login read from the sheet. No static database.json.
  - **Events:** Programming events (including Berlin coworking Wednesdays) live on the **Events** tab. Edit events directly in the sheet; no scripts needed. See `docs/LUMA_INTEGRATION.md`.
  - `pnpm sync:sheet` — Sheet → `public/data/database.json` (optional backup/export; needs `GOOGLE_SHEETS_API_KEY`).
  - `pnpm migrate:sheet` — `database.json` → Sheet (one-time populate; needs `GOOGLE_SERVICE_ACCOUNT_KEY` or `GOOGLE_APPLICATION_CREDENTIALS`).
- **Deploy.** **Vercel** is the primary deploy target (push to `main` → Vercel builds and deploys). Ensure sheet credentials are set in Vercel env so the serverless API can read the sheet.

### Open-source contributors (humans)

For onboarding, environment setup (including running **without** production Google keys via the local mock API), and PR expectations, see **[CONTRIBUTING.md](CONTRIBUTING.md)** and **[docs/README.md](docs/README.md)**. This file stays focused on technical facts for tools and maintainers.
