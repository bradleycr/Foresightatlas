# Backend integration

## Current state

- **Data:** The app reads from `public/data/database.json`. There is no in-memory or mock data layer.
- **Data layer:** All reads go through `src/services/database.ts`, which fetches `/data/database.json` (static file). No direct Express API calls from the frontend.
- **Optional Express server:** `server/index.js` exposes a read/write API for the same JSON file. Used for admin writes and optional suggestion/RSVP endpoints. Not required for read-only or static deploys.
- **Optional Google Sheets:** The sheet can be the source of truth. Sync runs before build (see `docs/SHEETS_SYNC.md`). Sync writes into `public/data/database.json`; the app still reads from that file.
- **Admin auth:** Admin users and credentials live in the JSON data (`adminUsers`). No separate auth service.

To switch to a real backend (e.g. Supabase), you only need to change `src/services/database.ts`: replace the fetch of `/data/database.json` with API calls to your backend. Keep the same TypeScript types and return shapes so the rest of the app stays unchanged.

## Example: Supabase

Use the same types (`Person`, `TravelWindow`, etc. from `src/types`). Example shape for a Supabase-backed `getPeople()`:

```ts
// In database.ts, replace loadDatabase() / getPeople() with:
export async function getPeople(): Promise<Person[]> {
  const { data, error } = await supabase.from('people').select('*');
  if (error) throw error;
  return data as Person[];
}
```

Schema and RLS ideas (tables: people, travel_windows, suggestions, admin_users) are standard; align column names with `src/types` and the existing JSON shape. Auth can stay in-app (e.g. AdminLoginModal) or move to Supabase Auth; the important part is that `database.ts` is the single place that loads people, travel windows, and suggestions.
