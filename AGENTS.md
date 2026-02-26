# AGENTS.md

## Cursor Cloud / AI instructions

### Overview

**Grantees and Fellows Map and Programming** — a React + TypeScript SPA (Vite) that visualizes Foresight Institute grantees, fellows, and prize winners on an interactive Leaflet map, plus per-node **Programming** pages (Berlin, SF) for event calendars. Data lives in a JSON file; an optional Express API server can serve/write it. Google Sheets can be the source of truth (sync before build).

### Naming and copy

- **App title:** “Grantees and Fellows Map and Programming” (order: grantees, then fellows; then map, then programming).
- **Subtext:** “A tool to help you connect to other grantees, fellows and nodees.”
- **Nav:** Desktop = “Map” + “Programming” (dropdown: Berlin, San Francisco). Mobile hamburger = “Foresight map”, “Berlin programming”, “SF programming”.
- **Footer:** “Foresight Institute · Grantees and Fellows Map and Programming · {year}”.

### Services

| Service | Command | Port | Notes |
|---|---|---|---|
| Vite dev server (frontend) | `pnpm dev` | 3000 | Main app; add `--host 0.0.0.0` for remote access |
| Express API server | `pnpm dev:api` | 3001 | Optional; needed only for admin write operations |
| Both together | `pnpm dev:all` | 3000 + 3001 | Uses `concurrently` |

### Key caveats

- **No linter or test runner configured.** No ESLint, Prettier, or test framework in `package.json`; no `lint` or `test` scripts.
- **No external services required for basic run.** Database is `public/data/database.json`. No Docker, PostgreSQL, Redis, or API keys required to run locally.
- **Frontend reads data statically.** `src/services/database.ts` fetches `/data/database.json`; it does **not** call the Express API. The Express server is a separate read/write API for the same file.
- **pnpm build scripts.** `@swc/core` and `esbuild` require approved build scripts via `pnpm.onlyBuiltDependencies` in `package.json`.
- **CSS `@import` warning.** Build may emit a PostCSS warning about `@import` order; cosmetic only.
- **Timeline view.** The Timeline tab exists but is “Coming soon” in the UI.
- **Vite port.** Dev server runs on port **3000** (set in `vite.config.ts`), not Vite’s default 5173.
- **Routes.** `/` = map, `/berlin` = Berlin Programming, `/sf` = SF Programming. Base-path-aware for GitHub Pages.
- **Mobile map behavior.** On mobile, when the filtered marker set is small (≤50), the map fits the view to those markers so users don’t have to pan to find grantees or event RSVPs.
- **Google Sheets.** Optional source of truth. See `docs/SHEETS_SYNC.md`.
  - `pnpm sync:sheet` — Sheet → `database.json` (needs `GOOGLE_SHEETS_API_KEY`). Skips missing tabs.
  - `pnpm migrate:sheet` — `database.json` → Sheet (needs `GOOGLE_SERVICE_ACCOUNT_KEY` or `GOOGLE_APPLICATION_CREDENTIALS`). One-time populate.
  - Deploy workflow runs sync before build when configured.
- **Events.** Programming pages use `public/data/events.json` (from Sheet + Luma). See `docs/LUMA_INTEGRATION.md`.
- General dev commands: `README.md`.
