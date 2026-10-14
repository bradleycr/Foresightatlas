# Self-serve magic links (`/access`)

Members enter **first name, last name, and the email on file**. If both match a
RealData row, Atlas shows a one-time `/claim?token=…` link on screen:

- **No password yet** → claim link (set password)
- **Already claimed** → password-reset link (24h)

**No DNS or Resend required.** Name + email on the roster is the gate. Rate
limited. Optional Resend email delivery can be added later without changing
this flow.

Share with the community: `https://atlas.foresight.org/access`

## Local / smoke test

```bash
pnpm test:access-request

# Or with the mock API running:
curl -s -X POST http://localhost:3001/api/member-access-request \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Alice","lastName":"Example","email":"alice@example.com"}'
```

Mock seed: Alice Example / `alice@example.com`.

## Optional later: email the link (Resend + DNS)

Only if you want inbox delivery instead of on-screen links. Verify a domain in
Resend, then set `RESEND_API_KEY` + `SMTP_FROM`. When mail is configured,
on-screen reveal turns off so the emailed one-time link isn’t burned.

## New people (not on the sheet yet)

Use the standing `/join?token=…` invite (`pnpm invite:link`), not `/access`.
