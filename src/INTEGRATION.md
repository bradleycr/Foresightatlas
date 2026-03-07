# Backend integration

## Current state

- **Data:** The app uses the **Google Sheet** as the single source of truth. There is no static `database.json` at runtime.
- **Data layer:** All reads go through `src/services/database.ts`, which fetches **GET /api/database**. The API (Express or Vercel serverless) reads from the Google Sheet via `server/sheet-database.js`. No fallback to a static JSON file.
- **Express server:** `server/index.js` provides GET /api/database (sheet), POST /api/member-login, POST /api/member-register, POST /api/member-password, POST /api/profile. All directory and profile operations read/write the sheet (Real Data tab). Optional best-effort write to `public/data/database.json` after sheet writes is for local scripts only; the app never reads that file at runtime.
- **Google Sheets:** Configure `GOOGLE_SHEETS_API_KEY` or `GOOGLE_SERVICE_ACCOUNT_KEY` and `SPREADSHEET_ID`. See `docs/SHEETS_SYNC.md`.
- **Admin auth:** Admin users live in the sheet (Admin Users tab). Directory (member) auth is backed by the Real Data tab (password hash per row).

To switch to another backend (e.g. Supabase), you would change the API layer (`server/sheet-database.js`, `server/realdata-store.js`, and the Vercel `api/` handlers) to read/write your store instead of the sheet, and keep `src/services/database.ts` calling GET /api/database and the same POST endpoints so the frontend stays unchanged.

## Example: Supabase

Use the same types (`Person`, `TravelWindow`, etc. from `src/types`). Example shape for a Supabase-backed `getPeople()`:

```ts
// In database.ts, replace fetchDatabase() / getPeople() with:
export async function getPeople(): Promise<Person[]> {
  const { data, error } = await supabase.from('people').select('*');
  if (error) throw error;
  return data as Person[];
}
```

Schema and RLS ideas (tables: people, travel_windows, suggestions, admin_users) are standard; align column names with `src/types` and the existing sheet/JSON shape. Auth can stay in-app or move to Supabase Auth; the important part is that `database.ts` is the single place that loads people, travel windows, and suggestions.
