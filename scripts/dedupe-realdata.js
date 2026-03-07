#!/usr/bin/env node
/**
 * Dedupe RealData by normalized full name, keeping the row with the most
 * information (richest profile). Writes the canonical set back to the sheet
 * and clears leftover duplicate rows.
 *
 * Usage:
 *   pnpm run dedupe:realdata          # run for real (requires service account)
 *   pnpm run dedupe:realdata -- --dry-run   # report only, no writes
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const {
  PEOPLE_HEADERS,
  PEOPLE_SHEET_WIDTH,
  REAL_DATA_TAB_NAMES,
} = require("./sheet-schema.js");
const {
  loadRealDataRecords,
  chooseCanonicalRecord,
  personRecordToRow,
  normalizeName,
  scorePersonRichness,
  SPREADSHEET_ID,
} = require("../server/realdata-store");

const DRY_RUN = process.argv.includes("--dry-run");

function groupByNormalizedName(records) {
  const groups = new Map();
  for (const record of records) {
    const key = normalizeName(record.person.fullName);
    if (!key) continue;
    const bucket = groups.get(key) || [];
    bucket.push(record);
    groups.set(key, bucket);
  }
  return groups;
}

async function main() {
  const loaded = await loadRealDataRecords({ write: true });
  const { sheets, sheetName, records } = loaded;

  const groups = groupByNormalizedName(records);
  const canonicalList = [];
  const duplicatesRemoved = [];

  for (const [normalizedName, bucket] of groups.entries()) {
    const canonical = chooseCanonicalRecord(bucket);
    canonicalList.push(canonical);
    if (bucket.length > 1) {
      const dropped = bucket.filter((r) => r !== canonical);
      duplicatesRemoved.push({
        name: canonical.person.fullName,
        normalizedName,
        keptRow: canonical.rowNumber,
        keptScore: scorePersonRichness(canonical.person),
        droppedRows: dropped.map((r) => r.rowNumber),
        droppedCount: dropped.length,
      });
    }
  }

  canonicalList.sort((a, b) =>
    (a.person.fullName || "").localeCompare(b.person.fullName || ""),
  );

  const totalBefore = records.length;
  const totalAfter = canonicalList.length;
  const removed = totalBefore - totalAfter;

  console.log(`RealData tab: ${sheetName}`);
  console.log(`Rows before: ${totalBefore}`);
  console.log(`Rows after (canonical): ${totalAfter}`);
  console.log(`Duplicate rows to remove: ${removed}`);
  if (duplicatesRemoved.length > 0) {
    console.log(`\nDuplicate groups (keeping richest row):`);
    duplicatesRemoved.slice(0, 25).forEach(({ name, keptRow, keptScore, droppedRows, droppedCount }) => {
      console.log(`  "${name}" → keep row ${keptRow} (score ${keptScore}), drop rows [${droppedRows.join(", ")}] (${droppedCount} row(s))`);
    });
    if (duplicatesRemoved.length > 25) {
      console.log(`  ... and ${duplicatesRemoved.length - 25} more groups`);
    }
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] No changes written. Run without --dry-run to apply.");
    return;
  }

  if (removed === 0) {
    console.log("\nNo duplicates to remove.");
    return;
  }

  const headerRow = PEOPLE_HEADERS;
  const dataRows = canonicalList.map((record) => personRecordToRow(record));
  const allRows = [headerRow, ...dataRows];
  const endRow = 1 + dataRows.length;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A1:${PEOPLE_SHEET_WIDTH}${endRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: allRows },
  });

  const clearStart = endRow + 1;
  const clearEnd = Math.max(500, totalBefore + 50);
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A${clearStart}:${PEOPLE_SHEET_WIDTH}${clearEnd}`,
    });
  } catch (err) {
    if (err.code !== 400) throw err;
  }

  console.log(`\nWrote ${totalAfter} canonical rows to '${sheetName}' and cleared duplicate rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
