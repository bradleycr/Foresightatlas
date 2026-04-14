# Documentation index

Start here if you are setting up locally, deploying, or integrating another backend.

| Doc | Purpose |
|-----|---------|
| [LOCAL_SETUP.md](LOCAL_SETUP.md) | One-page local runbook (env, ports, troubleshooting). |
| [SHEETS_SYNC.md](SHEETS_SYNC.md) | Google Sheet tabs, migration, sync scripts, column schema. |
| [EVENTS_SOURCE.md](EVENTS_SOURCE.md) | Where programming events come from (sheet + optional Luma). |
| [LUMA_INTEGRATION.md](LUMA_INTEGRATION.md) | Luma API and `pnpm sync:events`. |
| [SIGNAL_CHECKIN_SETUP.md](SIGNAL_CHECKIN_SETUP.md) | Optional Signal check-in bot (`signal-cli-rest-api`, sheet tabs, env). |
| [VERCEL_ENV.md](VERCEL_ENV.md) | Environment variables on Vercel. |
| [VERCEL_PRODUCTION.md](VERCEL_PRODUCTION.md) | Production / service account notes. |
| [VERCEL_CLI.md](VERCEL_CLI.md) | Using the Vercel CLI with this repo. |
| [MANUAL_UX_CHECKLIST.md](MANUAL_UX_CHECKLIST.md) | Smoke-test checklist before a release. |

Project root **[README.md](../README.md)** is the main overview. **[AGENTS.md](../AGENTS.md)** summarizes behavior for tools and contributors (ports, sheet as source of truth, scripts).

Maintainer-only reports (audit / sheet comparison) are written under **`reports/`** when you run `pnpm run audit:realdata`, `compare:sheet`, or `copyover-report` — see **`reports/README.md`**.
