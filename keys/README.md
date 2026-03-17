# Service account key (do not commit)

Put your Google Cloud service account JSON key file here for **local** and **Docker** use.

- **Filename:** `service-account.json` (or keep the downloaded name, e.g. `foresight-map-488423-5c500b89cc52.json`)
- **In `.env.local`** set one of:
  - `GOOGLE_APPLICATION_CREDENTIALS=./keys/service-account.json`  
  - or `GOOGLE_APPLICATION_CREDENTIALS=./keys/foresight-map-488423-5c500b89cc52.json`

All `*.json` files in this folder are gitignored. Never commit the key.

For **Vercel**, do not use a file — set **GOOGLE_SERVICE_ACCOUNT_KEY** to the full JSON string in Environment Variables (see docs/VERCEL_PRODUCTION.md).
