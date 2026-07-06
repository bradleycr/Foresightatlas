#!/usr/bin/env node
/**
 * RealData hygiene: delete junk rows, fix cohort years, normalize messy
 * city/country fields, and re-geocode where coordinates are missing.
 *
 *   node scripts/cleanup-data.js            # dry run
 *   node scripts/cleanup-data.js --apply    # write + geocode pass
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_KEY (write access).
 */

require("dotenv").config({ path: ".env.local", quiet: true });
require("dotenv").config({ quiet: true });

const { getSpreadsheetId } = require("./sheet-schema");
const {
  loadRealDataRecords,
  cloneRecord,
  upsertRealDataRecord,
  normalizeName,
  getSheetsClient,
} = require("../server/realdata-store");
const { geocodeCity } = require("../server/geocoding");

const APPLY = process.argv.includes("--apply");
const DELAY_MS = 1100;
/** Pause between sheet writes to stay under Google Sheets write quota (~60/min). */
const WRITE_DELAY_MS = 1200;

/** Rows to delete — junk or confirmed duplicates not on the fellows roster. */
const DELETE_NAMES = [
  "Akash Band.", // Abbreviated duplicate; Akash Patel (2023) is on roster.
];

/** Cohort year fixes (People tab / manual verification). */
const YEAR_FIXES = {
  [normalizeName('Ivan Seah')]: 2020,
  [normalizeName("Ye He")]: 2020,
  [normalizeName("Yelena Budovskaya")]: 2020,
};

/**
 * Manual city/country overrides for rows where automated parsing isn't safe.
 * Keys are normalized full names.
 */
const LOCATION_OVERRIDES = {
  [normalizeName("AE Studios")]: { city: "London", country: "United Kingdom" },
  [normalizeName("OpenMined (Lacey Strahm)")]: {
    city: "London",
    country: "United Kingdom",
  },
  [normalizeName("Esben Kran (Ashgro, Inc) (Apart)")]: {
    city: "Copenhagen",
    country: "Denmark",
  },
  [normalizeName("Sehr Zeb")]: { city: "London", country: "United Kingdom" },
  [normalizeName("Toby David Pilditch")]: {
    city: "London",
    country: "United Kingdom",
  },
  [normalizeName("Chiara Herzog")]: { city: "Glasgow", country: "United Kingdom" },
  [normalizeName("Bradley Love")]: { city: "London", country: "United Kingdom" },
  [normalizeName("Christopher Lakin")]: {
    city: "San Francisco",
    country: "United States",
  },
  [normalizeName("Claire Wang")]: {
    city: "Boston",
    country: "United States",
  },
  [normalizeName("Dawn Song")]: { city: "Boston", country: "United States" },
  [normalizeName("Harriet Farlow")]: {
    city: "Canberra",
    country: "Australia",
  },
  [normalizeName("Jamie Joyce")]: { city: "Berkeley", country: "United States" },
  [normalizeName("Janika Schmitt")]: { city: "Berlin", country: "Germany" },
  [normalizeName("Jasper Götting")]: { city: "Zürich", country: "Switzerland" },
  [normalizeName("Jonas Emanuel Müller")]: {
    city: "Zürich",
    country: "Switzerland",
  },
  [normalizeName("Konrad Kording")]: {
    city: "Philadelphia",
    country: "United States",
  },
  [normalizeName("Logan Thrasher Collins")]: {
    city: "St. Louis",
    country: "United States",
  },
  [normalizeName("Maxx Yung")]: { city: "New York", country: "United States" },
  [normalizeName("Moritz von Knebel")]: {
    city: "Berkeley",
    country: "United States",
  },
  [normalizeName("PK Douglas")]: {
    city: "Los Angeles",
    country: "United States",
  },
  [normalizeName("Tom Burns")]: { city: "Melbourne", country: "Australia" },
  [normalizeName("Zan Huang")]: { city: "Ann Arbor", country: "United States" },
  [normalizeName("Zhonghao He; Tianyi (Alex) Qiu")]: {
    city: "Cambridge",
    country: "United Kingdom",
  },
  [normalizeName("Zihao Ou")]: { city: "Dallas", country: "United States" },
};

/** Mark historical fellows not on the current roster as alumni. */
const MARK_ALUMNI_NAMES = [
  "Alevtina Evgrafova",
  "Alexander Briand",
  "Christopher Wilmer",
  'Dr Huanyu "Larry" Cheng',
  "Dr Yuxuan Lu",
  "Dr. Mariam Elgabry",
  "Eva-Maria Strauch",
  "Kelvin Yu",
  "Kevin Lalli",
  "Melissa Dumartin",
  "Nell Watson",
  "Patrick Mellor",
  "Tony Lai",
  "William E Halal",
  "Ying Tong",
].map(normalizeName);

function isPlaceholderLocation(value) {
  const s = String(value || "")
    .trim()
    .toLowerCase();
  return s === "global" || s === "tba" || s === "unknown" || s === "n/a";
}

/** Best-effort parse of prose / multi-location city strings. */
function normalizeCityField(city, country) {
  let c = String(city || "").trim();
  let co = String(country || "").trim();

  if (!c) return { city: "", country: co };

  const updateMatch = c.match(/Update:\s*([^.]+)/i);
  if (updateMatch) c = updateMatch[1].trim();

  if (c.length > 80) {
    const based = c.match(/based in\s+([^,.]+(?:,\s*[A-Za-z .]{2,20})?)/i);
    if (based) c = based[1].trim();
  }

  if (/\s+or\s+/i.test(c) && c.length < 60) {
    c = c.split(/\s+or\s+/i)[0].trim();
  }

  if (c.includes(".") && c.length > 35) {
    c = c.split(".")[0].trim();
  }

  c = c.replace(/\.\s*Next year.*/i, "").trim();

  if (c.includes("/") && c.length < 40) {
    c = c.split("/")[0].trim();
  } else if (c.includes("/")) {
    const parts = c.split("/").map((p) => p.trim());
    c = parts[parts.length - 1] || parts[0];
  }

  if (c.includes(";") && c.length > 25) {
    c = c.split(";")[0].trim();
  }

  if (isPlaceholderLocation(co)) {
    const commaParts = c.split(",").map((p) => p.trim());
    if (commaParts.length >= 2) {
      const last = commaParts[commaParts.length - 1];
      if (/^(USA|US|United States|UK|United Kingdom|Canada|Germany|France|Australia)$/i.test(last)) {
        co = last.replace(/^US$/i, "United States").replace(/^UK$/i, "United Kingdom");
        c = commaParts.slice(0, -1).join(", ");
      }
    }
  }

  return { city: c, country: co };
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function upsertWithDelay(sheets, sheetName, record) {
  await upsertRealDataRecord(sheets, sheetName, record);
  await sleep(WRITE_DELAY_MS);
}

async function getSheetId(sheets, spreadsheetId, sheetName) {
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const match = (data.sheets || []).find(
    (s) => s.properties && s.properties.title === sheetName,
  );
  if (!match) throw new Error(`Could not find sheet tab "${sheetName}".`);
  return match.properties.sheetId;
}

async function deleteRows(sheets, sheetName, rowNumbers) {
  if (rowNumbers.length === 0) return;
  const spreadsheetId = getSpreadsheetId();
  const sheetId = await getSheetId(sheets, spreadsheetId, sheetName);
  const requests = rowNumbers
    .sort((a, b) => b - a)
    .map((rowNumber) => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: rowNumber - 1,
          endIndex: rowNumber,
        },
      },
    }));
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

async function geocodeMissingCoords(loaded) {
  const needGeocode = loaded.records.filter((record) => {
    const p = record.person;
    const city = (p.currentCity || "").trim();
    const lat = p.currentCoordinates?.lat ?? 0;
    const lng = p.currentCoordinates?.lng ?? 0;
    return city.length > 0 && lat === 0 && lng === 0;
  });

  let done = 0;
  for (let i = 0; i < needGeocode.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
    const record = needGeocode[i];
    const p = record.person;
    const result = await geocodeCity(
      p.currentCity,
      p.currentCountry || undefined,
    );
    if (!result) continue;
    const updated = cloneRecord(record);
    updated.person.currentCoordinates = { lat: result.lat, lng: result.lng };
    if (!updated.person.currentCountry?.trim() && result.country) {
      updated.person.currentCountry = result.country;
    }
    await upsertWithDelay(loaded.sheets, loaded.sheetName, updated);
    done++;
  }
  return done;
}

async function main() {
  const loaded = await loadRealDataRecords({ write: APPLY });
  const changes = [];
  const toDelete = [];

  for (const record of loaded.records) {
    const key = normalizeName(record.person.fullName);
    const patches = [];

    if (DELETE_NAMES.some((n) => normalizeName(n) === key)) {
      toDelete.push({ row: record.rowNumber, name: record.person.fullName });
      continue;
    }

    let updated = cloneRecord(record);
    let touched = false;

    const yearFix = YEAR_FIXES[key];
    if (yearFix && !updated.person.fellowshipCohortYear) {
      updated.person.fellowshipCohortYear = yearFix;
      patches.push(`year → ${yearFix}`);
      touched = true;
    }

    if (MARK_ALUMNI_NAMES.includes(key) && !updated.person.isAlumni) {
      updated.person.isAlumni = true;
      patches.push("isAlumni → true");
      touched = true;
    }

    const override = LOCATION_OVERRIDES[key];
    if (override) {
      if (override.city && updated.person.currentCity !== override.city) {
        updated.person.currentCity = override.city;
        patches.push(`city → ${override.city}`);
        touched = true;
      }
      if (override.country && updated.person.currentCountry !== override.country) {
        updated.person.currentCountry = override.country;
        patches.push(`country → ${override.country}`);
        touched = true;
      }
      if (touched) {
        updated.person.currentCoordinates = { lat: 0, lng: 0 };
        patches.push("coords cleared (re-geocode)");
      }
    } else if (updated.person.currentCity?.trim()) {
      const normalized = normalizeCityField(
        updated.person.currentCity,
        updated.person.currentCountry,
      );
      const cityChanged = normalized.city !== updated.person.currentCity;
      const countryChanged =
        normalized.country !== (updated.person.currentCountry || "");
      if (cityChanged || countryChanged) {
        updated.person.currentCity = normalized.city;
        updated.person.currentCountry = normalized.country;
        updated.person.currentCoordinates = { lat: 0, lng: 0 };
        patches.push(
          `normalized → ${normalized.city}, ${normalized.country || "?"}`,
        );
        touched = true;
      }
    }

    if (
      updated.person.currentCountry &&
      isPlaceholderLocation(updated.person.currentCountry)
    ) {
      updated.person.currentCountry = "";
      patches.push("cleared placeholder country");
      touched = true;
    }

    if (touched) {
      changes.push({ name: record.person.fullName, patches });
      if (APPLY) {
        await upsertWithDelay(loaded.sheets, loaded.sheetName, updated);
      }
    }
  }

  const line = "─".repeat(60);
  console.log(`\n${line}\nDATA CLEANUP ${APPLY ? "(APPLY)" : "(DRY RUN)"}\n${line}`);
  console.log(`Rows to delete: ${toDelete.length}`);
  for (const d of toDelete) console.log(`  ✗ row ${d.row}  ${d.name}`);
  console.log(`\nRows to update: ${changes.length}`);
  for (const c of changes.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  • ${c.name}: ${c.patches.join("; ")}`);
  }

  if (!APPLY) {
    console.log(`\n${line}\nDRY RUN — nothing written. Re-run with --apply.\n${line}\n`);
    return;
  }

  if (toDelete.length > 0) {
    await deleteRows(
      loaded.sheets,
      loaded.sheetName,
      toDelete.map((d) => d.row),
    );
    console.log(`\n✓ Deleted ${toDelete.length} row(s).`);
    // Reload after deletions shift row numbers.
    Object.assign(loaded, await loadRealDataRecords({ write: true }));
  }

  const geocoded = await geocodeMissingCoords(loaded);
  console.log(`✓ Geocoded ${geocoded} row(s) with missing coordinates.`);
  console.log(`${line}\n`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
