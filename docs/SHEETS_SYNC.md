# Using Google Sheets as the database

The Foresight Map can use [this Google Sheet](https://docs.google.com/spreadsheets/d/1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ/edit?usp=sharing) as the source of truth. Data is synced **from** the sheet **to** `public/data/database.json` (at build time or when you run the sync script). The app always reads from that JSON file.

## Why is the sheet still empty?

The **API key** you added only lets the app **read** from the sheet. It does **not** write to it. To fill the sheet with your existing data (227 people, 21 travel windows), you must run the **one-time migration** (see below). That step uses a **Service Account** with write access, not the API key. Until you run `pnpm run migrate:sheet` once, the sheet stays empty and sync will have nothing to pull. Your current `public/data/database.json` is unchanged until you run `sync:sheet` — and if you run sync before migrating, it would overwrite the JSON with empty data, so do the migration first.

## Sheet structure

The spreadsheet uses four tabs. Row 1 must be the header row; data starts at row 2.

| Tab            | Purpose        | Key columns |
|----------------|----------------|-------------|
| **People**     | Fellows, grantees, prize winners | id, fullName, roleType, fellowshipCohortYear, currentCity, currentCountry, lat, lng, primaryNode, focusTags (JSON array), … |
| **TravelWindows** | Travel / residency / conference entries | id, personId, title, city, country, lat, lng, startDate, endDate, type, notes |
| **Suggestions** | Pending location-update requests | id, personName, personEmailOrHandle, requestedChangeType, requestedPayload (JSON), createdAt, status |
| **AdminUsers**  | Admin logins (if used)         | id, displayName, email, passwordPlaceholder |
| **RSVPs**       | Event RSVPs (going / interested / not-going) | eventId, personId, fullName, status, createdAt, updatedAt |

- **RSVPs**: Added by sync/migrate. The app reads via GET /api/rsvps and writes via POST /api/rsvps (Vercel serverless).
- **Suggestions**: Users submit via the “Suggest an update” form; POST /api/suggestions appends to this tab (requires `GOOGLE_SERVICE_ACCOUNT_KEY` on Vercel).
- **focusTags** and **requestedPayload** are stored as JSON strings (e.g. `["Secure AI","Neurotechnology"]`, `{"currentCity":"Berlin"}`).
- **lat** / **lng** are numbers. **isAlumni** is `TRUE` / `FALSE` in the sheet.

Exact column order and names are in `scripts/sheet-schema.js`.

---

## One-time: migrate existing data into the sheet

To copy everything from `public/data/database.json` into the Google Sheet:

1. **Google Cloud**: Create a project, enable the **Google Sheets API**, and create a **Service Account**. Download its JSON key.
2. **Share the sheet**: Open the spreadsheet → Share → add the service account email (e.g. `xxx@project.iam.gserviceaccount.com`) as **Editor**.
3. **Run the migration** (one time):

   ```bash
   # Option A: file path to key
   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/key.json pnpm run migrate:sheet

   # Option B: inline JSON (useful in CI/cloud)
   GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}' pnpm run migrate:sheet
   ```

This creates the four tabs (if missing) and fills them from `database.json`.

---

## Ongoing: sync sheet → app (for builds and local dev)

To pull the latest sheet data into `public/data/database.json`:

1. **Make the sheet readable**: Share the spreadsheet so **Anyone with the link can view** (required for API key access).
2. **Google Cloud**: In the same project, create an **API key**, restrict it to the **Google Sheets API** (optional but recommended).
3. **Run sync**:

   ```bash
   # In .env.local (or env):
   SPREADSHEET_ID=1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ
   GOOGLE_SHEETS_API_KEY=your-api-key

   pnpm run sync:sheet
   ```

   Then build or run the app as usual; it will use the updated `public/data/database.json`.

If `GOOGLE_SHEETS_API_KEY` is not set, `sync:sheet` does nothing and does not overwrite the existing JSON.

---

## GitHub Pages deploy

To have each deploy use the latest sheet data:

1. In the repo: **Settings → Secrets and variables → Actions**:
   - Add secret: `GOOGLE_SHEETS_API_KEY` = your Google API key.
   - Optionally add variable: `SPREADSHEET_ID` (defaults to the Foresight Map sheet ID if unset).
2. The deploy workflow runs `node scripts/sync-sheet-to-json.js` before `pnpm run build`. If the secret is set, the built site uses data from the sheet; if not, it uses the committed `public/data/database.json`.

---

## Summary

| Goal                         | Command / step |
|-----------------------------|----------------|
| Copy current JSON → Sheet   | `pnpm run migrate:sheet` (needs `GOOGLE_SERVICE_ACCOUNT_KEY` or `GOOGLE_APPLICATION_CREDENTIALS`) |
| Pull Sheet → JSON locally   | `pnpm run sync:sheet` (needs `GOOGLE_SHEETS_API_KEY`, sheet shared “Anyone can view”) |
| Deploy with sheet data      | Add `GOOGLE_SHEETS_API_KEY` (and optionally `SPREADSHEET_ID`) in GitHub Actions secrets/vars |

From then on, edit the [Foresight Map Database](https://docs.google.com/spreadsheets/d/1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ/edit?usp=sharing) sheet; the next sync (or deploy) will update the app data.

---

## Vercel deploy

In **Project → Settings → Environment Variables** add:

- `GOOGLE_SHEETS_API_KEY` — your Google API key (so each build can pull from the sheet).
- Optionally `SPREADSHEET_ID` (defaults to the Foresight Map sheet ID if unset).

The `vercel.json` build runs sync then build, so the deployed site will use the latest sheet data when the key is set.
