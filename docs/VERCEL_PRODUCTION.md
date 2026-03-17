# Vercel production: sheet-only, production-ready

The app is **always** connected to the Google Sheet in production. There is no static JSON backup at build or runtime. Data loads from the sheet on every request (with a short cache).

**Note:** The env var `USE_SHEET_AS_DATABASE` is not used anywhere in the app. You can remove it from Vercel if it’s set.

---

## What you need in Vercel (2 env vars)

In **Vercel** → your project → **Settings** → **Environment Variables**, set these for **Production** (and Preview if you want):

| Variable | Value |
|----------|--------|
| **SPREADSHEET_ID** | Your Google Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`. If you use the Foresight Map sheet, it’s `1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ`. |
| **GOOGLE_SERVICE_ACCOUNT_KEY** | The **entire** JSON key from Google Cloud (service account key). Paste the full JSON; mark as **Sensitive**. |

That’s it. No other env vars are required for the map + profile updates to work.

---

## Add the key to Vercel (step-by-step)

1. Open your service account JSON file (e.g. `keys/service-account.json` or the one from Google Cloud).
2. Copy the **entire** contents (all lines, from `{` to `}`).
3. In **Vercel** → your project → **Settings** → **Environment Variables**:
   - Click **Add New**.
   - **Key:** `GOOGLE_SERVICE_ACCOUNT_KEY`
   - **Value:** Paste the full JSON (one line is fine; Vercel accepts multi-line too).
   - Check **Sensitive** so it’s hidden in the UI.
   - Environment: **Production** (and **Preview** if you want).
   - Save.
4. Add **SPREADSHEET_ID** the same way (value: your sheet ID; not sensitive).
5. **Redeploy** (Deployments → ⋮ → Redeploy).

**Share the Google Sheet** with the service account: open the sheet → **Share** → add the service account email (e.g. `foresight-map@foresight-map-488423.iam.gserviceaccount.com`) as **Editor**.

---

## How to get a new key (if you need one)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and select your project.
2. **APIs & Services** → **Library** → enable **Google Sheets API**.
3. **APIs & Services** → **Credentials** → **Create credentials** → **Service account** → create and open it → **Keys** → **Add key** → **JSON** → download.
4. Use the file locally (see `keys/README.md`) and/or paste its contents into Vercel as **GOOGLE_SERVICE_ACCOUNT_KEY**.

---

## After changing env vars

Redeploy so the new values are used: **Deployments** → open the **⋯** on the latest deployment → **Redeploy**. Or push a commit to trigger a new build.

---

## What runs in production

- **Build:** Only `pnpm run build` (Vite). No sheet access at build time; no `database.json` is created or used.
- **Runtime:** Every page load calls **GET /api/database**, which reads from the Google Sheet. Profile saves call **POST /api/profile**, which writes to the sheet. All data is live from the sheet.

If **GOOGLE_SERVICE_ACCOUNT_KEY** or **SPREADSHEET_ID** is missing or wrong, the app will show an error asking you to set them in Vercel. Fix the env vars and redeploy.
