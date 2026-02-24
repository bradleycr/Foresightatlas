# Foresight Fellows Map & Timeline

A web app for visualizing where Foresight Institute fellows, grantees, and prize winners are located and where they're traveling. Built for the Foresight community to see who's where and when.

## What it does

The app shows two views:

- **Map view**: Interactive world map with markers showing where people are currently or will be traveling. Click markers to see who's at each location.
- **Timeline view**: Gantt-style timeline showing upcoming travel windows, residencies, and conferences.

Anyone can browse the map and timeline, filter by program type, focus area, or location. People can also suggest location updates through a public form. Admins review and approve these suggestions.

## Running it locally

You'll need Node.js installed. The app uses a simple Express server for the database (JSON file).

**Environment variables (optional):** For a new environment or integrations (e.g. Supabase), copy `.env.example` to `.env.local` and set any values you need. The app runs without env vars using the default API server and local JSON data.

```bash
# Install dependencies
npm install

# Start both the API server and frontend
npm run dev:all

# Or run them separately:
npm run dev:api    # Starts server on port 3001
npm run dev        # Starts frontend on port 5173
```

The app will be available at `http://localhost:5173`. The database is stored in `public/data/database.json`. You can use a **Google Sheet** as the source of truth and sync into that file — see [docs/SHEETS_SYNC.md](docs/SHEETS_SYNC.md).

## Tech stack

- React with TypeScript
- Vite for building
- Tailwind CSS for styling
- shadcn/ui components
- React Leaflet for the map
- Express server for the JSON database API

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
└── index.js            # Express API server

public/data/
└── database.json       # JSON database file
```

## Data model

The app tracks three main things:

**People** (fellows, grantees, prize winners):
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

To add an admin user, add them to the `adminUsers` array in `public/data/database.json`.

## Backend integration

Right now it uses a JSON file with an Express server. The code is set up to swap this out for a real database. See `src/INTEGRATION.md` for details on connecting to Supabase or another backend.

All database operations go through `src/services/database.ts`, so you only need to update that file when switching backends.

## Development notes

The map uses React Leaflet. If you want to use Google Maps instead, you'd need to swap out the MapView component. The current setup works fine for this use case.

The app is responsive and works on mobile, tablet, and desktop. The timeline view can be organized by person or by location, and you can filter by year, month, or week.

## License

Built for Foresight Institute.
