#!/usr/bin/env node
/**
 * Geocode Real Data tab: fill lat/lng for everyone who has a city but no coordinates.
 *
 * Reads the Real Data tab, finds rows where currentCity is set and (lat, lng) are 0 or
 * missing, calls Nominatim to geocode, and writes the coordinates (and country if empty)
 * back to the sheet. Respects 1 req/sec (Nominatim usage policy).
 *
 * Run once to backfill the sheet so the map shows everyone with a city without
 * relying on client-side geocoding. Re-run anytime you add new people with cities.
 *
 * Requires write access to the sheet (service account).
 * Env: SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS
 *
 *   node scripts/geocode-sheet.js
 *   pnpm run geocode:sheet
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { getSheetsClient, loadRealDataRecords, cloneRecord, upsertRealDataRecord } = require("../server/realdata-store");
const { geocodeCity } = require("../server/geocoding");

const DELAY_MS = 1100; // Nominatim: max 1 request per second

async function main() {
  const sheets = await getSheetsClient({ write: true });
  if (!sheets) {
    console.error("Google Sheets write credentials required. Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS.");
    process.exit(1);
  }

  console.log("Loading Real Data tab...");
  const loaded = await loadRealDataRecords({ write: true });
  const needGeocode = loaded.records.filter((record) => {
    const p = record.person;
    const city = (p.currentCity || "").trim();
    const lat = p.currentCoordinates?.lat ?? 0;
    const lng = p.currentCoordinates?.lng ?? 0;
    return city.length > 0 && (lat === 0 || lng === 0);
  });

  console.log(`Real Data: ${loaded.records.length} rows, ${needGeocode.length} need geocoding.`);
  if (needGeocode.length === 0) {
    console.log("Nothing to do. All rows with a city already have coordinates.");
    console.log("To refresh the app's data from the sheet, run  pnpm run sync:sheet  or use USE_SHEET_AS_DATABASE.");
    return;
  }

  let done = 0;
  let failed = 0;
  for (let i = 0; i < needGeocode.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS));

    const record = needGeocode[i];
    const p = record.person;
    const city = (p.currentCity || "").trim();
    const country = (p.currentCountry || "").trim() || undefined;

    const result = await geocodeCity(city, country);
    if (!result) {
      console.warn(`  Skip (no result): ${p.fullName} — ${city}`);
      failed++;
      continue;
    }

    const toWrite = cloneRecord(record);
    toWrite.person.currentCoordinates = { lat: result.lat, lng: result.lng };
    if (!toWrite.person.currentCountry?.trim() && result.country) {
      toWrite.person.currentCountry = result.country;
    }

    await upsertRealDataRecord(loaded.sheets, loaded.sheetName, toWrite);
    done++;
    console.log(`  ${done}/${needGeocode.length}: ${p.fullName} → ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)} (${result.city}${result.country ? `, ${result.country}` : ""})`);
  }

  console.log(`Done. Geocoded ${done} rows, ${failed} skipped (no result).`);
  console.log("");
  console.log("Next: so the map shows these coordinates immediately on load:");
  console.log("  • Use live sheet: set USE_SHEET_AS_DATABASE=true and run the API; the app will load from the sheet.");
  console.log("  • Or update static JSON: run  pnpm run sync:sheet  then reload (or redeploy).");
  console.log("  • Or one command:  pnpm run geocode:sheet:and-sync  (geocode + sync in one go).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
