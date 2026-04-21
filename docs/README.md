# Documentation index

This folder supplements the root **[README.md](../README.md)** and **[CONTRIBUTING.md](../CONTRIBUTING.md)**. Use it when you are setting up locally, deploying to Vercel, or integrating another backend.

| Doc | Purpose |
|-----|---------|
| [CONTRIBUTING.md](../CONTRIBUTING.md) | How to fork, run the app (with or without sheet keys), and open PRs. |
| [LOCAL_SETUP.md](LOCAL_SETUP.md) | One-page local runbook (env, ports, troubleshooting). |
| [SHEETS_SYNC.md](SHEETS_SYNC.md) | Google Sheet tabs, migration, sync scripts, column schema. |
| [EVENTS_SOURCE.md](EVENTS_SOURCE.md) | Where programming events come from (sheet + optional Luma). |
| [LUMA_INTEGRATION.md](LUMA_INTEGRATION.md) | Luma API and `pnpm sync:events`. |
| [SIGNAL_CHECKIN_SETUP.md](SIGNAL_CHECKIN_SETUP.md) | Optional Signal check-in bot (`signal-cli-rest-api`, sheet tabs, env). |
| [VERCEL_ENV.md](VERCEL_ENV.md) | Environment variables on Vercel. |
| [VERCEL_PRODUCTION.md](VERCEL_PRODUCTION.md) | Production / service account notes. |
| [VERCEL_CLI.md](VERCEL_CLI.md) | Using the Vercel CLI with this repo. |
| [MANUAL_UX_CHECKLIST.md](MANUAL_UX_CHECKLIST.md) | Smoke-test checklist before a release. |

Project root **[README.md](../README.md)** is the main product overview. **[AGENTS.md](../AGENTS.md)** is a concise runbook (ports, sheet as source of truth, Vite base path) aimed at maintainers and AI-assisted workflows.

**Security:** Report vulnerabilities per **[.github/SECURITY.md](../.github/SECURITY.md)**, not public issues.

Maintainer-only reports (audit / sheet comparison) are written under **`reports/`** when you run `pnpm run audit:realdata`, `compare:sheet`, or `copyover-report` — see **`reports/README.md`**.
