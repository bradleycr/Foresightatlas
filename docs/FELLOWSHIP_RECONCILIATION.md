# Fellowship reconciliation: Website vs Google Sheet

**Source of truth:** [Foresight Fellowship](https://foresight.org/engage/fellowship/) (website).  
**Compared to:** Fellows and Senior Fellows in the Foresight Map **Google Sheet** (RealData tab). The app reads from the sheet only; `public/data/database.json` is not used for adding new fellows.

Reconciliation date: 2025-03-14.

---

## 1. On the website but NOT on the sheet → **Add via script (Google Sheet only)**

The following **18 fellows** appeared on the fellowship site (default/2026 view, first page(s)) and were **not** in the sheet. They are added **directly to the Google Sheet** (RealData tab) by the sync script, which also fetches each fellow’s bio from their profile page and writes it to **expandedProjectDescription**.

| Name |
|------|
| Abigail Olvera |
| Alberto Privitera |
| Alex Plesa |
| Avery Krieger |
| Constanze Albrecht |
| Donnacha Fitzgerald |
| Elisa Kallioniemi |
| Fin Moorhouse |
| Gianluca Cidonio |
| Huixin Zhan |
| Jakub Lála |
| Kathryn Shelley |
| Keith Patarroyo |
| Konlin Shen |
| Léo Pio-Lopez |
| Mahlaqua Mila Noor |
| Mateo Petel |
| Max Kanwal |

**Next step:** Run the fellowship sync script (requires write access to the sheet via Service Account):

```bash
# Add these 18 fellows to RealData and fetch their bios from foresight.org/people/{slug}/
GOOGLE_SERVICE_ACCOUNT_KEY='...' pnpm run sync:fellows

# Only update bios for existing Fellow/Senior Fellow rows (backfill all)
pnpm run sync:fellows -- --bios-only

# Only append new fellows, do not fetch bios
pnpm run sync:fellows -- --add-only
```

The script writes only to the **Google Sheet**; it does not modify `public/data/database.json`.

### Scrape all years (2017–2026) and sync missing fellows

To collect every fellow from the website (all years and pagination) and add any missing to the sheet:

```bash
# 1. Scrape the fellowship page (Playwright). Writes scripts/website-fellows.json.
pnpm run scrape:fellowship

# 2. Add missing fellows to the sheet and fetch bios + profile image URLs.
GOOGLE_SERVICE_ACCOUNT_KEY='...' pnpm run sync:fellows -- --from-file=website-fellows.json
```

Profile image URLs are stored in the **profileImageUrl** column (foresight.org hosts the images; we only store the URL so they show in the app without hosting them).

---

## 2. On the sheet but not on the website

We did **not** scrape the full fellowship site (all years 2017–2026 and all pages for Regular and Senior). Only the first page(s) under the default and 2026 filters were captured, so we have a **partial** list of website fellows (the 18 above).

Therefore we **cannot** reliably list “on sheet but not on website” without a full scrape. You should verify manually:

1. Open [Fellowship – Foresight Institute](https://foresight.org/engage/fellowship/).
2. Use **Year** (2026, 2025, … 2017) and **Fellowship Type** (Regular, Senior).
3. Go through each page of results and check whether everyone currently on your sheet still appears. If someone is no longer listed, treat the website as source of truth and remove or flag them in the sheet.

**Likely placeholders / bad data on the sheet** (worth checking against the site and removing if not fellows):

- `dantevonhespburg@gmail.com` (Fellow, cohort 0)
- `jsarkar` (Fellow, cohort 0)
- Single or partial names, e.g. `Ala`, `Ghada`, `Mikayla`
- `Akash Band.` (trailing period; may be a typo for “Akash Band” or similar)

---

## 3. Summary

| Action | Count |
|--------|--------|
| **Added to sheet via sync script** (on website, not on sheet) | 18 |
| **On sheet, not in our website sample** | 241 (need manual check by year/page on site) |

The app reads from the **Google Sheet** at runtime. After you run `pnpm run sync:fellows`, the new fellows and their bios will be in the RealData tab and will show in the map and profile modals. Long bios in the app use a “Show more” / “Show less” control in the profile view.
