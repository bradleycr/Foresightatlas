# RealData audit report

- Sheet tab audited: `RealData`
- Total person rows: **361**
- Duplicate normalized full names: **0**
- Rows missing explicit IDs: **0**
- Rows missing current city: **244**
- Rows missing current country: **254**
- Rows with zero coordinates: **360**
- Rows that still require password change: **0**
- Rows already claimed: **0**

## Canonical duplicate resolution rules

1. Keep one canonical row per normalized full name unless a true same-name collision is confirmed.
2. Prefer the row with the richest profile data: city/country, coordinates, focus tags, project text, and links.
3. Prefer rows that already have a password hash or claim timestamp when richness is otherwise comparable.
4. Preserve the canonical row's `id` and merge non-conflicting data from weaker duplicates into it.
5. Archive or delete the leftover duplicate rows only after the canonical row is complete.

## Highest-priority duplicate groups

No duplicate names detected.
