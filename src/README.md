# Foresight Atlas (frontend)

React + TypeScript UI: map, programming pages, profiles, and community features.

## Overview

- **Map** — Leaflet map and sidebar list with filters.
- **Programming** — Node event calendars, RSVPs, and check-ins when the API provides them.
- **Profile / directory** — Sheet-backed member profiles and auth via `/api/*`.

For full-stack setup, environment variables, deploy, and how to contribute, see the root **[README.md](../README.md)**, **[CONTRIBUTING.md](../CONTRIBUTING.md)**, and **[docs/README.md](../docs/README.md)**.

## Project structure (this folder)

```
src/
├── components/     # UI (map, programming, modals, shadcn/ui)
├── pages/          # Route-level views
├── services/       # API clients — database.ts is the main data entry point
├── types/          # Shared TypeScript types
└── App.tsx         # App shell and routing
```

## Backend integration

The SPA expects a working **`/api`** that serves the shapes defined in `types/` and used in `services/database.ts`, `memberAuth.ts`, `rsvp.ts`, and `checkin.ts`.

To plug in a different backend (or a partner-hosted API), read **[INTEGRATION.md](INTEGRATION.md)** — same-origin proxy, `VITE_API_ORIGIN`, and route compatibility are covered there.

The root README previously referred to a JSON file database; **runtime data always comes from the API + Google Sheet** in the default configuration.
