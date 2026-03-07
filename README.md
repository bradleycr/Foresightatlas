# Grantees and Fellows Map and Programming

A web app for visualizing where Foresight Institute grantees, fellows, and prize winners are located and where they're traveling. Built for the Foresight community to see who's where and when.

**Internal tool** — If you've been invited to contribute, see [Contributing](#contributing).

## What it does

The app shows two views:

- **Map view**: Interactive world map with markers showing where people are currently or will be traveling. Click markers to see who's at each location.
- **Timeline view**: Gantt-style timeline showing upcoming travel windows, residencies, and conferences.

Anyone can browse the map and timeline, filter by program type, focus area, or location. People can also suggest location updates through a public form. Admins review and approve these suggestions.

## Running it locally

You'll need Node.js installed. The app uses a simple Express server for the database (JSON file).

**Environment variables (optional):** For a new environment or integrations (e.g. Google Sheets), copy `.env.example` to `.env.local` and set any values you need. **The app requires the API and Google Sheet to be configured** — there is no static database.json at runtime. Without sheet credentials, GET /api/database will fail.

```bash
# Install dependencies
pnpm install

# Start both the API server and frontend
pnpm dev:all

# Or run them separately:
pnpm dev:api    # Starts server on port 3001
pnpm dev        # Starts frontend on port 3000
```

The app will be available at `http://localhost:3000`. **Data is loaded from the Google Sheet** via the API (GET /api/database). Configure the sheet and credentials — see [docs/SHEETS_SYNC.md](docs/SHEETS_SYNC.md).

## Deploy on Vercel

This app is **Vite + React** (not Next.js). Vercel supports it out of the box.

1. Push your repo to GitHub and go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
2. Vercel will detect Vite from `vercel.json` / `package.json`. Use:
   - **Build Command:** (leave default; `vercel.json` sets it to run sheet sync then `pnpm run build`)
   - **Output Directory:** `dist`
   - **Install Command:** `pnpm install`
3. Add environment variables for the live sheet (required for data to load):
   - `GOOGLE_SHEETS_API_KEY` or `GOOGLE_SERVICE_ACCOUNT_KEY`
   - `SPREADSHEET_ID` — optional; defaults to the Foresight Map sheet ID
4. Deploy. The app fetches data from GET /api/database (sheet). No static database.json at runtime.

## Tech stack

- React with TypeScript
- Vite for building
- Tailwind CSS for styling
- shadcn/ui components
- React Leaflet for the map
- Express server for the database API (reads/writes Google Sheet)

## Project structure

```
src/
├── components/          # React components
│   ├── MapView.tsx     # Map visualization
│   ├── TimelineView.tsx # Timeline/Gantt view
│   ├── FiltersBar.tsx  # Search and filters
│   ├── AdminPanel.tsx  # Admin interface
│   └── ui/             # shadcn/ui components
├── services/
│   ├── database.ts     # API calls to backend
│   └── geocoding.ts    # City geocoding
├── types/
│   └── index.ts        # TypeScript types
└── App.tsx             # Main app component

server/
└── index.js            # Express API (sheet-backed)

public/data/
└── database.json       # Optional export/cache (not used at runtime; see docs/SHEETS_SYNC.md)
```

## Data model

The app tracks three main things:

**People** (grantees, fellows, prize winners):
- Basic info: name, role type, cohort year, focus areas
- Location: home base and current city/country with coordinates
- Project: tagline and description
- Node affiliation: Bay Area, Berlin, or Global

**Travel Windows**:
- Where someone will be (city, country, coordinates)
- When (start/end dates)
- Type: residency, conference, workshop, visit, etc.
- Notes

**Location Suggestions**:
- Public submissions for location updates
- Status: pending, accepted, or rejected
- Admins review and approve these

## Admin access

There's a simple admin login (currently using hardcoded credentials in the JSON database). Admins can:
- Review pending location suggestions
- Accept or reject suggestions
- Edit people and travel windows directly

To add an admin user, add them to the **Admin Users** tab in the Google Sheet (or the sheet-backed data). See docs/SHEETS_SYNC.md.

## Backend integration

Right now it uses the **Google Sheet** as the source of truth, with an Express (or Vercel serverless) API that reads and writes the sheet. See `src/INTEGRATION.md` and `docs/SHEETS_SYNC.md` for details.

All database operations go through `src/services/database.ts`, so you only need to update that file when switching backends.

## Development notes

The map uses React Leaflet. If you want to use Google Maps instead, you'd need to swap out the MapView component. The current setup works fine for this use case.

The app is responsive and works on mobile, tablet, and desktop. The timeline view can be organized by person or by location, and you can filter by year, month, or week.

## Contributing

This repo is an internal Foresight Institute tool. We invite selected people to contribute. If you have access and want to contribute, please read [CONTRIBUTING.md](CONTRIBUTING.md) for how to report issues, suggest changes, and submit pull requests. By participating, you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT License. Copyright (c) 2025 Foresight Institute. See [LICENSE](LICENSE).
