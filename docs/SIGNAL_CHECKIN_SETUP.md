# Signal Check-in Bot — Setup Guide

The Signal check-in feature is **optional**. If you don’t configure it, the app runs exactly as before. The bot only starts when all required env vars are set.

## Web check-ins vs Signal (two sheet paths)

| Path | Sheet tabs | Who writes | Who reads |
|------|------------|------------|-----------|
| **Web / programming page** | **CheckIns** | Browser via `POST /api/checkins` (`src/services/checkin.ts`) | `GET /api/checkins`, merged with localStorage in the UI (“The Table”). |
| **Signal bot** | **SignalCheckins** (audit log) + **DailyTable-Berlin** / **DailyTable-SF** (grid) | Signal poller after `/checkin` commands | Optional `GET /api/revalidate-daily-table` for polling the daily grid after Signal updates. |

These are **not** merged automatically: Signal and web check-ins are separate flows today. You can run both in parallel; choose one as canonical per workflow if you standardize later.

## What you need

1. **signal-cli-rest-api** — Docker container that bridges your app to Signal.
2. **A Signal number** — Registered with that container (dedicated number recommended).
3. **A Signal group** — The group where people send `/checkin` commands.
4. **Group ID** — Base64 ID of that group (see below).
5. **Google Sheet tabs** — `SignalCheckins` and `DailyTable-Berlin` / `DailyTable-SF` (see schema below).

---

## 1. Run signal-cli-rest-api (Docker)

```bash
docker run -d --name signal-api -p 8080:8080 \
  -v signal-data:/home/.local/share/signal-cli \
  bbernhard/signal-cli-rest-api:latest
```

Or use the project’s Compose file:

```bash
docker compose up -d signal-api
```

API base: `http://localhost:8080` (or `http://signal-api:8080` from another container).

---

## 2. Register your Signal number

One-time registration. Replace `+1234567890` with your number (E.164).

```bash
curl -X POST "http://localhost:8080/v1/register/+1234567890"
```

Complete the captcha if prompted. For production you’ll use a number that can receive the verification SMS/call.

Link an existing Signal account (optional, if you already use Signal on a device):

```bash
curl -X POST "http://localhost:8080/v1/register/+1234567890/link" \
  -H "Content-Type: application/json" \
  -d '{"deviceName": "Foresight Bot"}'
```

---

## 3. Create the Signal group and get Group ID

1. Create a new group in Signal (or use an existing one).
2. Add the bot’s number to the group.
3. Get the group ID via the API:

```bash
# List groups (replace NUMBER with your bot number)
curl -s "http://localhost:8080/v1/groups/NUMBER" | jq .
```

Each group has an `id` field (Base64). Copy that — it’s your `SIGNAL_GROUP_ID`.

If the REST API doesn’t expose group list, you can get the group ID from a message received in that group: the receive payload includes `dataMessage.groupInfo.groupId`.

---

## 4. Add sheet tabs to your Google Sheet

In the same spreadsheet as your existing data (same `SPREADSHEET_ID`):

### Tab: **SignalCheckins**

Row 1 (headers):

| Timestamp | UserPhone | UserName | Action | RawMessage | ParsedDates | NodeSlug | GroupId |

(No data required in row 2+; the bot appends rows.)

### Tab: **DailyTable-Berlin** (or **DailyTable-SF**)

Row 1 (headers):

| Date | UserPhone | UserName | Status | Notes | UpdatedAt |

Again, data rows are created/updated by the bot.

Create **DailyTable-SF** too if you have an SF node; same columns.

---

## 5. Set environment variables

In `.env.local` (or your deployment env), set:

```env
# Required for the bot to start
SIGNAL_API_URL=http://localhost:8080
SIGNAL_NUMBER=+1234567890
SIGNAL_GROUP_ID=base64groupidhere
SIGNAL_NODE_SLUG=berlin

# Optional
SIGNAL_POLL_INTERVAL_MS=5000
```

- **SIGNAL_API_URL** — `http://localhost:8080` locally; in Docker use `http://signal-api:8080`.
- **SIGNAL_NUMBER** — E.164 (e.g. `+491701234567`).
- **SIGNAL_GROUP_ID** — Base64 group ID from step 3.
- **SIGNAL_NODE_SLUG** — `berlin` or `sf`; decides which DailyTable tab is updated.

Sheet access uses your existing vars: `GOOGLE_SHEETS_API_KEY` (read) and `GOOGLE_SERVICE_ACCOUNT_KEY` or `GOOGLE_APPLICATION_CREDENTIALS` (write).

---

## 6. Run the app (with or without the bot)

**Without Signal** (bot does not start; app unchanged):

```bash
pnpm dev:api
```

**With Signal** (all four vars set; poller starts after the server):

```bash
pnpm dev:api
```

Or run the poller alone (e.g. separate process):

```bash
pnpm dev:signal
```

Or run everything (Vite + API + Signal):

```bash
pnpm dev:all
```

---

## 7. Test in the group

In the Signal group, send:

- ` /checkin Ja this week Monday Wednesday Friday`
- ` /checkin Nein March 18th`
- ` /checkin Yes next Friday`

The bot should reply with a short confirmation and the sheet tabs should get new rows.

---

## Run tests (no Signal or Sheets needed)

```bash
pnpm test:signal-checkin
```

This runs date parsing and command-detection checks only. It does not call the Signal API or Google Sheets.

---

## Troubleshooting

| Symptom | Check |
|--------|------|
| Bot never starts | Ensure all four vars are set and server logs show no `[server] Signal poller failed to start`. |
| No reply in group | Confirm `SIGNAL_GROUP_ID` matches the group; bot only reacts to messages from that group. |
| "Sheet write not configured" | Set `GOOGLE_SERVICE_ACCOUNT_KEY` (or `GOOGLE_APPLICATION_CREDENTIALS`) and share the sheet with the service account email. |
| Dates wrong | Bot uses `Europe/Berlin`; server TZ should be set (e.g. `TZ=Europe/Berlin` in Docker). |
| receive/send errors | Ensure signal-cli-rest-api is healthy and the number is registered; check container logs. |

---

## Summary

- **App is safe without Signal** — Bot only starts when `SIGNAL_API_URL`, `SIGNAL_NUMBER`, `SIGNAL_GROUP_ID`, and `SIGNAL_NODE_SLUG` are all set.
- **Quick validation** — `pnpm test:signal-checkin` (no external services).
- **Full flow** — Docker (signal-api) → register number → create group → get group ID → add sheet tabs → set env → run `pnpm dev:api` or `pnpm dev:all`.
