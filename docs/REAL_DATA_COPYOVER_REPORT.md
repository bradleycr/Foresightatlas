# Copy-over report: People (test) tab → Real Data tab

This report finds **matched rows by full name** between the People tab and the Real Data tab, then checks which fields in the People tab have values that could fill **empty** fields in Real Data.

---
## Summary

- **People tab rows (with name):** 227
- **Real Data rows (with name):** 417
- **Matched by fullName:** 256

## Usable data: fields you can copy from People → Real Data

For each field, **count** = number of *matched* Real Data rows that are empty and have a value in the People tab.

| Field | Copyable count | Sample (fullName, value from People) |
|-------|----------------|----------------------------------------|
| currentCity | 209 | Roman Bauer: "Guildford…"; Elena Sergeeva: "Cambridge…"; Herbert Fountain: "Ithaca…" |
| currentCountry | 211 | Roman Bauer: "UK…"; Elena Sergeeva: "USA…"; Herbert Fountain: "USA…" |
| lat | 119 | Roman Bauer: "51.2362…"; Roman Bauer: "51.2362…"; Roman Bauer: "51.2362…" |
| lng | 119 | Roman Bauer: "-0.5704…"; Roman Bauer: "-0.5704…"; Roman Bauer: "-0.5704…" |
| profileUrl | 0 | — |
| contactUrlOrHandle | 228 | Roman Bauer: "r.bauer@surrey.ac.uk…"; Roman Bauer: "r.bauer@surrey.ac.uk…"; Roman Bauer: "r.bauer@surrey.ac.uk…" |
| shortProjectTagline | 103 | Roman Bauer: "Assistant Professor at University of Sur…"; Roman Bauer: "Assistant Professor at University of Sur…"; Roman Bauer: "Assistant Professor at University of Sur…" |
| expandedProjectDescription | 103 | Roman Bauer: "Assistant Professor at University of Sur…"; Roman Bauer: "Assistant Professor at University of Sur…"; Roman Bauer: "Assistant Professor at University of Sur…" |
| affiliationOrInstitution | 0 | — |
| primaryNode | 0 | — |
| focusTags | 256 | Roman Bauer: "Longevity Biotechnology…"; Roman Bauer: "Longevity Biotechnology…"; Roman Bauer: "Longevity Biotechnology…" |

## How to copy over

1. Open the [Foresight Map Database](https://docs.google.com/spreadsheets/d/1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ/edit) sheet.
2. In the **Real Data** tab, for each matched row (same fullName as in People), paste or type the value from the **People** tab for the fields you want to bring over (e.g. lat, lng, profileUrl, currentCity, currentCountry).
3. Run `pnpm run sync:sheet` to refresh the app.
