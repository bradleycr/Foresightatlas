#!/usr/bin/env node
/**
 * One-off RealData hygiene pass:
 *   • delete obvious junk rows (an email stored as a name, a stray handle)
 *   • collapse the known same-person duplicate rows, keeping the richest /
 *     claimed copy and deleting the rest
 *
 * Groups are listed by EXACT current sheet name (stable across row shifts).
 * Safe by default: prints a plan and writes nothing. Pass --apply to delete.
 * Deletions go bottom-up via deleteDimension so row numbers stay valid.
 *
 * Usage:
 *   node scripts/cleanup-realdata.js            # dry run
 *   node scripts/cleanup-realdata.js --apply    # delete rows
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { getSpreadsheetId } = require("./sheet-schema");
const {
  loadRealDataRecords,
  scorePersonRichness,
} = require("../server/realdata-store");

/** Names that are clearly not real people. */
const JUNK_NAMES = ["dantevonhespburg@gmail.com", "jsarkar"];

/** Same person stored under multiple rows — keep one, delete the others. */
const DUPLICATE_GROUPS = [
  ["Konstantinos Konstantinidis", "Kostas Konstantinidis"],
  ["Logan  Collins", "Logan T Collins", "Logan Thrasher Collins"],
  ["Qiu Yunyan", "Yunyan Qiu"],
  ["David A Leigh", "Professor David A Leigh"],
  ["Robin D Hanson", "Robin Hanson"],
];

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

/** Best row to keep: claimed first, then has email, then richest, then top-most. */
function pickKeeper(records) {
  return records
    .slice()
    .sort((a, b) => {
      const pw = (b.auth.passwordHash ? 1 : 0) - (a.auth.passwordHash ? 1 : 0);
      if (pw) return pw;
      const em = (b.person.email ? 1 : 0) - (a.person.email ? 1 : 0);
      if (em) return em;
      const rich = scorePersonRichness(b.person) - scorePersonRichness(a.person);
      if (rich) return rich;
      return a.rowNumber - b.rowNumber;
    })[0];
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

async function main() {
  const apply = process.argv.includes("--apply");
  const loaded = await loadRealDataRecords({ write: apply });
  const records = loaded.records;
  const byName = new Map();
  for (const r of records) {
    const key = norm(r.person.fullName);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(r);
  }

  const toDelete = []; // { rowNumber, name, reason }
  const seenRows = new Set();
  const add = (rec, reason) => {
    if (seenRows.has(rec.rowNumber)) return;
    seenRows.add(rec.rowNumber);
    toDelete.push({ rowNumber: rec.rowNumber, name: rec.person.fullName, reason });
  };

  for (const junk of JUNK_NAMES) {
    for (const rec of byName.get(norm(junk)) || []) add(rec, "junk");
  }

  const keepers = [];
  for (const group of DUPLICATE_GROUPS) {
    const members = group.flatMap((name) => byName.get(norm(name)) || []);
    if (members.length <= 1) {
      keepers.push({ group: group[0], note: `only ${members.length} row found — skipped` });
      continue;
    }
    const keeper = pickKeeper(members);
    keepers.push({
      group: group[0],
      keep: `${keeper.person.fullName} (row ${keeper.rowNumber})`,
    });
    for (const rec of members) if (rec.rowNumber !== keeper.rowNumber) add(rec, `dup of "${keeper.person.fullName}"`);
  }

  const line = "─".repeat(60);
  console.log(`\n${line}\nREALDATA CLEANUP ${apply ? "(APPLY)" : "(DRY RUN)"}\n${line}`);
  console.log("Keepers:");
  for (const k of keepers) console.log(`  ✓ ${k.group}: ${k.keep || k.note}`);
  console.log(`\nRows to delete (${toDelete.length}):`);
  for (const d of toDelete.sort((a, b) => a.rowNumber - b.rowNumber)) {
    console.log(`  ✗ row ${d.rowNumber}  ${d.name}  [${d.reason}]`);
  }

  if (!apply) {
    console.log(`\n${line}\nDRY RUN — nothing deleted. Re-run with --apply.\n${line}\n`);
    return;
  }

  const spreadsheetId = getSpreadsheetId();
  const sheetId = await getSheetId(loaded.sheets, spreadsheetId, loaded.sheetName);
  // Delete bottom-up so earlier row indices remain valid.
  const requests = toDelete
    .map((d) => d.rowNumber)
    .sort((a, b) => b - a)
    .map((rowNumber) => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: rowNumber - 1, // 0-based, inclusive
          endIndex: rowNumber, // exclusive
        },
      },
    }));

  await loaded.sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
  console.log(`\n✓ Deleted ${requests.length} row(s).\n${line}\n`);
}

main().catch((error) => {
  console.error("Cleanup failed:", error?.message || error);
  process.exit(1);
});
