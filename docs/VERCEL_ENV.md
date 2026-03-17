# Vercel environment variables

The app reads and writes the **Google Sheet** in production. There is **no static database.json at runtime** — the sheet is the only source of truth.

**USE_SHEET_AS_DATABASE:** The app **never** reads this env var. If it’s set in Vercel or `.env.local`, you can remove it; it has no effect. The app always uses the sheet when sheet credentials are present.

For profile updates, RSVPs, and suggestions to work, and for the map to load, set these in Vercel.

## If you see "file does not exist" or ENOENT (e.g. lstat '/Users')

That usually means **GOOGLE_APPLICATION_CREDENTIALS** is set to a **local file path** (e.g. `/Users/you/Downloads/...json`). On Vercel that path doesn't exist, so the app fails. **Fix:** In Vercel, **remove** **GOOGLE_APPLICATION_CREDENTIALS** and set **GOOGLE_SERVICE_ACCOUNT_KEY** to the **full JSON** of the service account key (paste the entire key contents). The app prefers the JSON env var and does not need a file path in production.

## Why profile update fails with “credentials not configured”

If you only have **GOOGLE_SHEETS_API_KEY** and **SPREADSHEET_ID** in Vercel, the map loads (read works) but **profile save fails**. The Google Sheets API key is **read-only**. Saving a profile (or RSVPs, suggestions) requires **write** access, which needs **GOOGLE_SERVICE_ACCOUNT_KEY** (the full JSON key from a Google Cloud service account). Add that env var in Vercel and redeploy.

## Required for production

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| **SPREADSHEET_ID** | Which sheet to use | The ID from the sheet URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`. Default in code: `1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ`. |
| **GOOGLE_SERVICE_ACCOUNT_KEY** | Read + write (profiles, RSVPs, suggestions) | Google Cloud Console → APIs & Services → Credentials → Create Service Account → Key (JSON). Paste the **entire JSON object** as the value (one line or multi-line). Share the sheet with the service account email as **Editor**. |

**Optional (alternative for read-only):**

- **GOOGLE_SHEETS_API_KEY** — If you only need the app to *load* data and not save profiles, you can use an API key instead. Sheet must be shared **“Anyone with the link can view”**. Profile updates and RSVPs will still require **GOOGLE_SERVICE_ACCOUNT_KEY**.

## Add via Vercel dashboard

1. Open [Vercel](https://vercel.com) → your project → **Settings** → **Environment Variables**.
2. Add **SPREADSHEET_ID** (value: your sheet ID; can use the default above).
3. Add **GOOGLE_SERVICE_ACCOUNT_KEY** (value: full JSON key; mark as **Sensitive**).
4. Redeploy (e.g. trigger a new deploy from the Deployments tab or push a commit).

## Add via Vercel CLI

From the project root. If the project isn’t linked yet, run `npx vercel link` and follow the prompts, then:

```bash
# List current env (see what’s already set)
vercel env ls

# Add spreadsheet ID (production)
vercel env add SPREADSHEET_ID production
# Paste the ID when prompted (or press Enter to skip if you use the default in code).

# Add service account key (production) — paste the full JSON when prompted
vercel env add GOOGLE_SERVICE_ACCOUNT_KEY production
# When prompted, paste the entire contents of your service-account key JSON.
# Choose “sensitive” so it’s hidden in the UI.
```

Then redeploy:

```bash
vercel --prod
# or push to main and let Vercel auto-deploy
```

## What uses what

- **GET /api/database** (map load): uses **GOOGLE_SHEETS_API_KEY** or **GOOGLE_SERVICE_ACCOUNT_KEY** + **SPREADSHEET_ID**. If missing, the app shows “Google Sheets credentials are not configured” and the map won’t load.
- **POST /api/profile** (save profile): uses **GOOGLE_SERVICE_ACCOUNT_KEY** + **SPREADSHEET_ID**. If missing, users see “Google Sheets write credentials are not configured” when updating their profile.
- **POST /api/rsvps**, **POST /api/suggestions**: same as profile — need **GOOGLE_SERVICE_ACCOUNT_KEY**.

So for “people can go in and update their profile,” you **must** set **GOOGLE_SERVICE_ACCOUNT_KEY** (and **SPREADSHEET_ID** if different from the default) in Vercel.

## Data is live

- The app does **not** use a static backup at runtime. It always loads from **GET /api/database**, which reads from the Google Sheet.
- Profile saves write straight to the sheet. After someone updates their profile, the next load of the map (or refresh) will show their changes; we cache responses for up to 60 seconds per server instance, so updates appear within a minute.

---

## Docker / self-hosted

The repo includes a **Dockerfile** for self-hosted deployment. The app does **not** use `database.json` at runtime; it always talks to the Google Sheet.

**Build and run:**

```bash
docker build -t foresightmap .
docker run --env-file .env.local -p 3001:3001 foresightmap
```

**Required env at runtime** (pass via `--env-file` or `-e`):

- **SPREADSHEET_ID** — your sheet ID (or rely on default in code).
- **GOOGLE_SERVICE_ACCOUNT_KEY** — full JSON key (for read + write: map load, profile updates, RSVPs). Or **GOOGLE_SHEETS_API_KEY** for read-only (map loads; profile save will fail).

Optional: **LUMA_API_KEY** (for events merge), **SIGNAL_*** (for check-in poller). See `docs/SIGNAL_CHECKIN_SETUP.md` if you use Signal.

The container serves the API on port 3001. Put a reverse proxy (e.g. nginx, Caddy) in front for HTTPS and to serve the built frontend from `dist` (or host the SPA separately and point it at the API).
