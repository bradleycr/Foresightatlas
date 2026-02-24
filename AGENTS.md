# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Foresight Fellows Map & Timeline — a React + TypeScript SPA (Vite) that visualizes Foresight Institute fellows on an interactive Leaflet map, plus per-node Programming pages for event calendars. An optional Express API server serves the JSON flat-file database.

### Services

| Service | Command | Port | Notes |
|---|---|---|---|
| Vite dev server (frontend) | `pnpm dev` | 3000 | Main app; add `--host 0.0.0.0` for remote access |
| Express API server | `pnpm dev:api` | 3001 | Optional; needed only for admin write operations |
| Both together | `pnpm dev:all` | 3000 + 3001 | Uses `concurrently` |

### Key caveats

- **No linter or test runner configured.** The project has no ESLint, Prettier, or test framework in `package.json`. There are no `lint` or `test` scripts.
- **No external services required.** The database is a JSON file at `public/data/database.json`. No Docker, PostgreSQL, Redis, or API keys needed.
- **Frontend reads data statically.** `src/services/database.ts` fetches `/data/database.json` directly — it does NOT call the Express API. The Express server is a standalone read/write API for the same file; they are not wired together in the current code.
- **pnpm build scripts.** `@swc/core` and `esbuild` require approved build scripts. This is configured via `pnpm.onlyBuiltDependencies` in `package.json`.
- **CSS `@import` warning.** The build emits a PostCSS warning about `@import` order in the CSS. This is cosmetic and does not break the build.
- **Timeline view is disabled.** The Timeline tab is marked "Coming soon" in the UI.
- **Vite config port.** `vite.config.ts` sets the dev server to port 3000, not Vite's default 5173.
- **SPA routes.** `/` = map, `/berlin` = Berlin Node Programming, `/sf` = SF Node Programming. Routing is base-path-aware for GitHub Pages.
- **Google Sheets database.** The app can use a Google Sheet as source of truth. See `docs/SHEETS_SYNC.md` for full details.
  - `pnpm sync:sheet` — pulls Sheet → `database.json` (needs `GOOGLE_SHEETS_API_KEY`). Gracefully skips missing tabs.
  - `pnpm migrate:sheet` — pushes `database.json` → Sheet (needs `GOOGLE_SERVICE_ACCOUNT_KEY` or `GOOGLE_APPLICATION_CREDENTIALS`). Run once to populate the sheet.
  - The deploy workflow (`.github/workflows/deploy.yml`) runs sync before build automatically.
- Standard dev commands are documented in `README.md`.
