# Self-serve magic links (`/access`)

Members enter **first name, last name, and the email on file**. If both match a
RealData row, Atlas emails a one-time `/claim?token=…` link:

- **No password yet** → claim link (set password)
- **Already claimed** → password-reset link (24h)

The UI always says “if we find a match, we’ll email you” — it does not reveal
whether the name/email existed (anti-enumeration).

## Local test (no Resend, not live)

```bash
# Terminal 1 — mock or sheet-backed API
AUTH_REVEAL_LINKS=true CLAIM_BASE_URL=http://localhost:3000 pnpm dev

# Or hit the API directly after the server is up:
curl -s -X POST http://localhost:3001/api/member-access-request \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Alice","lastName":"Example","email":"alice@example.com"}'
```

In mock mode, Alice Example / `alice@example.com` is seeded. The JSON may
include `claim_link` when mail isn’t configured — open that URL to finish
claiming.

## Go-live (Resend + noreply@foresight.org)

1. Resend → API key + verify `foresight.org` (or a send subdomain)  
2. Vercel env: `RESEND_API_KEY`, `SMTP_FROM=Foresight Atlas <noreply@foresight.org>`,
   `SMTP_REPLY_TO=…`, `CLAIM_BASE_URL=https://atlas.foresight.org`  
3. Do **not** set `AUTH_REVEAL_LINKS` in production  
4. Smoke-test `/access` with your own roster email before announcing  

Code mirrors foresight-matchmaker’s `lib/auth/mail.ts` (Resend HTTP, not SMTP).

## New people (not on the sheet yet)

Use the standing `/join?token=…` invite (`pnpm invite:link`), not `/access`.
`/access` only helps people who are already on the roster with an email.
