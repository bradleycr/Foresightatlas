# Foresight Fellows Map & Timeline

A web app for visualizing where Foresight Institute fellows, grantees, and prize winners are located and where they're traveling.

## Overview

The app has two main views:
- **Map view**: Interactive world map showing where people are or will be
- **Timeline view**: Gantt-style timeline of upcoming travel and events

People can browse, filter, and search. Anyone can suggest location updates through a public form. Admins review and approve these suggestions.

## Running locally

See the main README in the project root for setup instructions.

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
```

## Backend integration

The app currently uses a JSON file with an Express server. See `INTEGRATION.md` for details on connecting to Supabase or another backend.

All database operations go through `services/database.ts`, so you only need to update that file when switching backends.
