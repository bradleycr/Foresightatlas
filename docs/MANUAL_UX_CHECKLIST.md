# Manual UX checklist — directory readiness

Use this after starting the app locally (`pnpm dev` and `pnpm dev:api` in two terminals, or `pnpm dev:all`) to verify key flows before sharing with the community.

**Note:** If the API is already running elsewhere (e.g. port 3001), the frontend may start on a different port (e.g. 3003). Open the URL Vite prints (e.g. http://localhost:3003/) and ensure the API base URL matches where your profile/login requests go (same origin or configured proxy).

## Map & list

- [ ] **Map loads** — Open `/`. Map shows world view; no console errors.
- [ ] **Sidebar list** — "Fellows & Grantees" list shows people; count matches expectations (e.g. 361 after dedupe).
- [ ] **No duplicate names** — Scan the list; same full name should not appear twice.
- [ ] **Unknown-location marker** — People without current city appear in a single off-map marker (e.g. "Location needed"); hover/click shows "People who have not set a current city yet."
- [ ] **Search** — Type a name in search; only one card per person. People without city still appear in results.
- [ ] **Filters** — Change year, program, node, alumni; list and map update; no duplicates introduced.
- [ ] **Person detail** — Click a person card or map popup; detail modal opens with correct data. Navigate prev/next when applicable.

## Profile & auth

- [ ] **Sign-in (first time)** — Click Profile → sign in with full name + `password123`. Session established; redirect to profile page.
- [ ] **First-login password** — After first sign-in, "Password and access" shows "Set a personal password"; Save profile is disabled until password is set. Set password (current: `password123`, new: 8+ chars). After success, Save profile is enabled.
- [ ] **Profile edit** — Change current city, country, alumni checkbox, cohort/end year, focus tags, tagline. Save. Success toast; data persists (refresh or re-open profile to confirm).
- [ ] **Optional location** — Clear current city/country; save. No validation error; profile saves. Person appears in "Location needed" on map and still in search.
- [ ] **Alumni copy** — Profile shows "Are you an alumni?" (not "Mark this profile as alumni").
- [ ] **Sign out** — Sign out from profile or header; identity cleared. Sign in again with new password; profile loads.

## Programming & mobile

- [ ] **Programming tabs** — Berlin and SF programming pages load; events and RSVPs show as expected.
- [ ] **Mobile list/map** — On narrow viewport, list/map toggle works; "Open list" / "Back to map" and touch targets are usable.
- [ ] **Safe areas** — On a device with notches or home indicator, content is not obscured.

## Quick verification commands

- `pnpm run audit:realdata` — Writes `reports/REALDATA_AUDIT_REPORT.md` (gitignored; see `reports/README.md`).
- `pnpm run sync:sheet` — Refresh `public/data/database.json` from RealData.
- `pnpm run test:sheet-roundtrip` — Profile write → sync → verify (uses one unique row).
- `pnpm run test:member-auth` — First-login + password change flow (uses one unclaimed row, then restores).
