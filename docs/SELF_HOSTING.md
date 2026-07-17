# Self-hosting (on-prem / sovereign node)

The Foresight Atlas is **open source**. The **roster and auth data are not**.  
Production data lives in a **private** Google Sheet (or any backend that implements the same `/api` contract). Credentials never ship in this repository.

**Direction of travel:** run the full stack on your own **sovereign compute** at a node (Berlin / SF), not only on a public cloud. Vercel is the current hosted path; this doc is the self-host shape.

## What stays private

| Asset | Public repo? | Notes |
|-------|--------------|--------|
| App source (React, API, scripts) | Yes (MIT) | Safe to fork and run |
| Production spreadsheet ID + contents | **No** | Set via env on your host only |
| Service account / API keys / session secrets | **No** | `.env` / secret store only |
| Member passwords / claim tokens | **No** | Sheet + `DIRECTORY_SESSION_SECRET` |

Contributors develop against the **file-backed mock API** (`pnpm dev` without Google keys). They never need production sheet access.

## Architecture for on-prem

Same processes as local “full stack” — one host, one origin:

```
┌─────────────────────────────────────────────────┐
│  Node host (Docker / bare metal / k8s)          │
│                                                 │
│   Vite static build (or `pnpm preview`)         │
│        │  reverse-proxy /api →                  │
│        ▼                                        │
│   Express API  (server/index.js)                │
│        │                                        │
│        ├── Google Sheet (private, SA editor)    │
│        ├── Luma API (optional, public events)   │
│        └── Google Calendar (optional)           │
└─────────────────────────────────────────────────┘
```

- **Frontend:** `pnpm build` → serve `dist/` (nginx, Caddy, Traefik, …).
- **API:** Node 20+ running `server/index.js` (or Docker — see [LOCAL_SETUP.md](LOCAL_SETUP.md)).
- **Proxy:** Route `/api/*` to the API so the SPA stays same-origin (no `VITE_API_ORIGIN` required).
- **Sheet:** Private; share only with the service account email as **Editor**. Prefer **not** “anyone with the link”.

Optional later: swap the sheet for a DB that still exposes the JSON shapes in [src/INTEGRATION.md](../src/INTEGRATION.md).

## Minimum env on the host

```bash
SPREADSHEET_ID=…                    # private — never commit
GOOGLE_SERVICE_ACCOUNT_KEY=…        # or GOOGLE_APPLICATION_CREDENTIALS=/path/key.json
DIRECTORY_SESSION_SECRET=…          # long random; must be stable across deploys
CLAIM_BASE_URL=https://atlas.your-node.example
# Optional:
LUMA_API_KEY=…
# GOOGLE_CALENDAR_* …
```

Full list: [`.env.example`](../.env.example), [VERCEL_ENV.md](VERCEL_ENV.md) (same names; different host).

## Run (production-style)

```bash
pnpm install
pnpm build
# API
NODE_ENV=production node server/index.js   # listens on PORT (default 3001)
# Static
# point your reverse proxy at dist/ and /api → :3001
```

Or Docker (see LOCAL_SETUP): mount `keys/`, pass env, expose 3000/3001 behind TLS at the node.

## Vercel today → on-prem tomorrow

| Today | Tomorrow (node) |
|-------|-----------------|
| Push `main` → Vercel | Build image / artifact on your CI |
| Secrets in Vercel env | Secrets in node vault / systemd / sops |
| Serverless `api/*.js` | Same handlers via Express `server/index.js` |
| Public demo URL | Internal or node-local URL + VPN / allowlist as you prefer |

The React app already talks only to `/api/*`. Moving the API off Vercel does not require a frontend rewrite.

## Checklist before calling a node “production”

- [ ] Sheet is **private**; only the service account (and trusted editors) have access  
- [ ] `DIRECTORY_SESSION_SECRET` set and backed up  
- [ ] TLS termination on the node edge  
- [ ] `pnpm build` succeeds; `/api/database` returns data when authenticated  
- [ ] Claim / reset links use the node’s public `CLAIM_BASE_URL`  
- [ ] Luma key present if you want live public calendar merge  
- [ ] Smoke test: [MANUAL_UX_CHECKLIST.md](MANUAL_UX_CHECKLIST.md)

## Related

- [LOCAL_SETUP.md](LOCAL_SETUP.md) — laptop / Docker day-to-day  
- [ARCHITECTURE.md](ARCHITECTURE.md) — data flow  
- [src/INTEGRATION.md](../src/INTEGRATION.md) — API contract for a custom backend  
- [CONTRIBUTING.md](../CONTRIBUTING.md) — mock-first OSS workflow  
