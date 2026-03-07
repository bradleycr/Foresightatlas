# Data comparison dossier: Mock / People tab vs Real Data

**Source of truth:** Real Data tab in the Foresight Map spreadsheet.
This dossier compares the current app data (mock/legacy), the **People** tab, and the **Real Data** tab.

---
## 1. Row and record counts

| Source | Rows in sheet | Records with valid ID (used in app) |
|--------|----------------|--------------------------------------|
| Current database.json (mock/legacy) | — | **417** |
| People tab | 227 | **227** |
| Real Data tab | 418 | **418** |

---
## 2. ID overlap

- **IDs only in current DB (not in Real Data or People):** 2
- **IDs only in People tab (not in Real Data):** 227
- **IDs only in Real Data (new):** 3
- **IDs in both current DB and Real Data:** 415
- **IDs in both People tab and Real Data:** 0

Sample IDs only in current DB: `realdata-44`, `realdata-45`

Sample IDs only in Real Data: `realdata-chiara-herzog-fellow-2025`, `realdata-mari-lle-van-kooten-fellow-2025`, `realdata-roman-bauer-fellow-2024`

---
## 3. Role type distribution

| roleType | Current DB | People tab | Real Data |
|----------|------------|------------|-----------|
| Fellow | 300 | 224 | 301 |
| Grantee | 86 | 2 | 86 |
| Prize Winner | 12 | 1 | 12 |
| Senior Fellow | 19 | — | 19 |

---
## 4. Primary node distribution

| primaryNode | Current DB | People tab | Real Data |
|-------------|------------|------------|-----------|
| Bay Area Node | — | 2 | — |
| Berlin Node | — | 2 | — |
| Global | 417 | 223 | 418 |

---
## 5. Name overlap (current vs Real Data)

Full names that appear in both current DB and Real Data: **366**.
Current DB unique names: **366**, Real Data unique names: **366**.

---
## 6. Field coverage (Real Data)

Percentage of Real Data records with a non-empty value:

- **fullName:** 100.0% (418/418)
- **currentCity:** 29.9% (125/418)
- **currentCountry:** 26.3% (110/418)
- **primaryNode:** 100.0% (418/418)
- **profileUrl:** 20.6% (86/418)
- **shortProjectTagline:** 0.0% (0/418)
- **lat:** 0.2% (1/418)
- **lng:** 0.2% (1/418)

---
## 7. Sheet headers

Expected People columns (schema): `id`, `fullName`, `roleType`, `fellowshipCohortYear`, `fellowshipEndYear`, `affiliationOrInstitution`, `focusTags`, `currentCity`, `currentCountry`, `lat`, `lng`, `primaryNode`, `profileUrl`, `contactUrlOrHandle`, `shortProjectTagline`, `expandedProjectDescription`, `isAlumni`, `passwordHash`, `mustChangePassword`, `claimedAt`, `lastProfileUpdatedAt`, `lastPasswordChangedAt`.

**People tab** (first row): `id`, `fullName`, `roleType`, `fellowshipCohortYear`, `fellowshipEndYear`, `affiliationOrInstitution`, `focusTags`, `currentCity`, `currentCountry`, `lat`, `lng`, `primaryNode`, `profileUrl`, `contactUrlOrHandle`, `shortProjectTagline`, `expandedProjectDescription`, `isAlumni`.

**Real Data tab** (first row): `id`, `fullName`, `roleType`, `fellowshipCohortYear`, `fellowshipEndYear`, `affiliationOrInstitution`, `focusTags`, `currentCity`, `currentCountry`, `lat`, `lng`, `primaryNode`, `profileUrl`, `contactUrlOrHandle`, `shortProjectTagline`, `expandedProjectDescription`, `isAlumni`.

---
## 8. Summary

- **Source of truth:** RealData tab. The app sync now uses RealData only for people records.
- **Sync command:** `pnpm run sync:sheet` (with GOOGLE_SHEETS_API_KEY set) writes Real Data → `public/data/database.json`.
- **Legacy People tab:** retained only for migration comparison. Runtime people data should no longer depend on it.
- **Travel Windows, Suggestions, Admin Users, RSVPs:** Still read from their existing tabs (TravelWindows, Suggestions, AdminUsers, RSVPs).
