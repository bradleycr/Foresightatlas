#!/usr/bin/env node
/**
 * Copy currentCity / currentCountry / lat / lng from the legacy **People** tab
 * into **RealData** for rows that are blank on RealData but have a real city
 * (not "Global" placeholder) on People.
 *
 *   node scripts/backfill-cities-from-people.js          # dry run
 *   node scripts/backfill-cities-from-people.js --apply  # write to sheet
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_KEY (write access).
 */

require("dotenv").config({ path: ".env.local", quiet: true });
require("dotenv").config({ quiet: true });

const {
  loadRealDataRecords,
  cloneRecord,
  upsertRealDataRecord,
  normalizeName,
  getSheetsClient,
} = require("../server/realdata-store");
const { PEOPLE_HEADERS, getSpreadsheetId } = require("./sheet-schema");

const APPLY = process.argv.includes("--apply");

function isRealCity(city) {
  const s = String(city || "").trim().toLowerCase();
  return s && s !== "global" && s !== "tba" && s !== "unknown" && s !== "n/a";
}

function parsePeopleRows(rows) {
  if (!rows || rows.length < 2) return [];
  const [headerRow, ...dataRows] = rows;
  const colIndex = {};
  headerRow.forEach((h, i) => {
    colIndex[String(h).trim()] = i;
  });
  const idx = (name) => colIndex[name] ?? PEOPLE_HEADERS.indexOf(name);
  return dataRows
    .map((row) => ({
      fullName: String(row[idx("fullName")] || "").trim(),
      currentCity: String(row[idx("currentCity")] || "").trim(),
      currentCountry: String(row[idx("currentCountry")] || "").trim(),
      lat: parseFloat(row[idx("lat")]),
      lng: parseFloat(row[idx("lng")]),
    }))
    .filter((p) => p.fullName);
}

async function loadPeopleTab() {
  const sheets = await getSheetsClient({ write: false });
  if (!sheets) throw new Error("Sheet read credentials required.");
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: "'People'!A:ZZ",
  });
  return parsePeopleRows(data.values || []);
}

async function main() {
  const peopleTab = await loadPeopleTab();
  const byName = new Map(peopleTab.map((p) => [normalizeName(p.fullName), p]));

  const loaded = await loadRealDataRecords({ write: APPLY });
  const toWrite = [];

  for (const record of loaded.records) {
    const person = record.person;
    if (person.currentCity?.trim()) continue;

    const legacy = byName.get(normalizeName(person.fullName));
    if (!legacy || !isRealCity(legacy.currentCity)) continue;

    const updated = cloneRecord(record);
    updated.person.currentCity = legacy.currentCity;
    if (!person.currentCountry?.trim() && legacy.currentCountry) {
      updated.person.currentCountry = legacy.currentCountry;
    }
    if (
      Number.isFinite(legacy.lat) &&
      Number.isFinite(legacy.lng) &&
      legacy.lat !== 0 &&
      legacy.lng !== 0
    ) {
      updated.person.currentCoordinates = { lat: legacy.lat, lng: legacy.lng };
    }
    toWrite.push({ record: updated, legacy });
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`CITY BACKFILL FROM PEOPLE TAB (${APPLY ? "APPLY" : "DRY RUN"})`);
  console.log(`${"─".repeat(60)}`);
  console.log(`People tab rows:     ${peopleTab.length}`);
  console.log(`RealData rows:       ${loaded.records.length}`);
  console.log(`To update:           ${toWrite.length}`);
  console.log("");

  for (const { record, legacy } of toWrite.sort((a, b) =>
    a.record.person.fullName.localeCompare(b.record.person.fullName),
  )) {
    const p = record.person;
    const coords = p.currentCoordinates;
    const coordNote =
      coords.lat !== 0 || coords.lng !== 0
        ? ` (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
        : "";
    console.log(
      `  ${p.fullName} → ${p.currentCity}, ${p.currentCountry || "?"}${coordNote}`,
    );
    if (APPLY) {
      await upsertRealDataRecord(loaded.sheets, loaded.sheetName, record);
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  if (APPLY) {
    console.log(`✓ Wrote ${toWrite.length} rows to RealData.`);
  } else {
    console.log("DRY RUN — nothing written. Re-run with --apply.");
  }
  console.log(`${"─".repeat(60)}\n`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
