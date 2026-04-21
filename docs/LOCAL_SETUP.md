# Run the whole app locally (handoff for tech)

One-page guide to get the Foresight Atlas app running and served on a single machine.

---

## 1. Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** (`npm install -g pnpm`)

---

## 2. Repo and install

```bash
git clone https://github.com/bradleycr/foresightatlas.git
cd foresightatlas
pnpm install
```

---

## 3. Environment variables (required for data)

Create **`.env.local`** in the project root (same folder as `package.json`). The app reads this automatically.

**Minimum to load the map and allow profile updates:**

Use **one** of these for the sheet credentials:

| Variable | What to put |
|----------|-------------|
| **GOOGLE_APPLICATION_CREDENTIALS** | Path to the key file, e.g. `./keys/service-account.json`. Put the JSON file in the `keys/` folder (see `keys/README.md`); it’s gitignored. |
| **GOOGLE_SERVICE_ACCOUNT_KEY** | The **full JSON** of the service account key (paste the entire contents of the key file). |

Plus:

| Variable | What to put |
|----------|-------------|
| `SPREADSHEET_ID` | Your sheet ID (default: `1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ`). |

**Optional (for events from Luma):**

| Variable | What to put |
|----------|-------------|
| `LUMA_API_KEY` | Luma calendar API key (see docs/LUMA_INTEGRATION.md) |

**Example `.env.local`** (if the key file is in `keys/service-account.json`):

```bash
SPREADSHEET_ID=1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ
GOOGLE_APPLICATION_CREDENTIALS=./keys/service-account.json
```

Or use the JSON directly (no file):

```bash
SPREADSHEET_ID=1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...",...}
```

**Note:** Do not commit `.env.local`. It is in `.gitignore`. You can share these values with the tech via a secure channel (e.g. 1Password, env file in a secure share).

### Where to get the Google keys

You have two options. The app needs at least one.

**Option A: API key (read-only)** — Map loads; profile save and RSVPs will not work.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and select (or create) a project.
2. **APIs & Services** → **Library** → search for **Google Sheets API** → **Enable**.
3. **APIs & Services** → **Credentials** → **Create credentials** → **API key**.
4. (Recommended) Restrict the key: **Edit** → under “API restrictions” choose “Restrict key” → select **Google Sheets API**.
5. In `.env.local` set: `GOOGLE_SHEETS_API_KEY=your-key-here`.
6. Share your Google Sheet with **“Anyone with the link” can view** (required for API key access).

**Option B: Service account key (read + write)** — Map loads and profile updates / RSVPs work.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and select (or create) the same project.
2. **APIs & Services** → **Library** → enable **Google Sheets API** if not already.
3. **APIs & Services** → **Credentials** → **Create credentials** → **Service account**. Give it a name (e.g. “Foresight Map”) → **Create and continue** → **Done**.
4. Click the new service account → **Keys** → **Add key** → **Create new key** → **JSON** → **Create**. A JSON file downloads.
5. Either:
   - **Use the file:** Put the file somewhere (e.g. project folder), and in `.env.local` set  
     `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/the-downloaded-file.json`  
     (If the file is ever moved or deleted, you’ll get “file not found” until you fix the path or switch to the next option.)
   - **Use the JSON in env:** Open the downloaded JSON, copy the **entire** contents, and in `.env.local` set  
     `GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}`  
     (paste the whole thing; one line is fine). You can then delete the file. This is better for Vercel and Docker.)
6. **Share the Google Sheet** with the service account: open the sheet → **Share** → add the **service account email** (e.g. `something@project-id.iam.gserviceaccount.com`) as **Editor**.

If you previously used a key file and it’s gone (e.g. deleted from Downloads), remove `GOOGLE_APPLICATION_CREDENTIALS` from `.env.local` and use `GOOGLE_SERVICE_ACCOUNT_KEY` with the JSON instead, or create a new service account key and add it as above.

---

## 4. Run the app (single command)

```bash
pnpm dev
```

This starts:

- **API** on port **3001** (or next free port 3002–3010)
- **Frontend** on port **3000**, proxying `/api` to the API

Open: **http://localhost:3000**

The map and directory data are loaded from the Google Sheet via the API. There is no static `database.json` at runtime.

---

## 5. Alternative: run API and frontend separately

```bash
# Terminal 1 – API
pnpm run dev:api

# Terminal 2 – Frontend (proxy targets port 3001 by default)
pnpm exec vite
```

Then open **http://localhost:5173** (Vite default) or **http://localhost:3000** if Vite is configured for 3000. The frontend will call the API for all data.

---

## 6. Docker (optional – same app, containerized)

Build and run with env from `.env.local` (use **GOOGLE_SERVICE_ACCOUNT_KEY** with the full JSON in `.env.local`, since the key file in `keys/` is not copied into the image):

```bash
docker build -t foresightatlas .
docker run --env-file .env.local -p 3001:3001 foresightatlas
```

Open **http://localhost:3001**. The app talks only to the Google Sheet.

**Using the key file with Docker:** mount the `keys` folder and set the path inside the container:

```bash
docker run -v "$(pwd)/keys:/app/keys" -e SPREADSHEET_ID=your-sheet-id -e GOOGLE_APPLICATION_CREDENTIALS=/app/keys/service-account.json -p 3001:3001 foresightatlas
```

---

## 7. What to give the tech (checklist)

- [ ] **Repo access** — clone from GitHub (or a zip of the repo).
- [ ] **`.env.local`** (or the values to put in it):
  - [ ] `SPREADSHEET_ID`
  - [ ] `GOOGLE_SERVICE_ACCOUNT_KEY` (full JSON; keep secret).
  - [ ] (Optional) `LUMA_API_KEY` if they need events.
- [ ] **Instructions:** “Run `pnpm install`, then `pnpm dev`. Open http://localhost:3000.”

That’s enough to have the whole app running and served locally with live data from the sheet and profile updates working.
