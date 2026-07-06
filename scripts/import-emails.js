#!/usr/bin/env node
/**
 * Import roster emails from a CSV into RealData.
 *
 * Accepts any CSV with a name column ("Full name" or "fullName") and an email
 * column ("Email (fill in)", "email", or "Email"). Only fills empty email
 * cells — never overwrites an address already on file.
 *
 *   node scripts/import-emails.js missing-emails.csv            # dry run
 *   node scripts/import-emails.js missing-emails.csv --apply    # write
 */

require("dotenv").config({ path: ".env.local", quiet: true });
require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const {
  loadRealDataRecords,
  cloneRecord,
  upsertRealDataRecord,
  normalizeName,
} = require("../server/realdata-store");

const APPLY = process.argv.includes("--apply");
const WRITE_DELAY_MS = 1200;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      if (row.some((v) => String(v).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((v) => String(v).trim())) rows.push(row);
  }
  return rows;
}

function isEmail(value) {
  const s = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 120;
}

function loadImportMap(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const header = rows[0].map((h) => String(h).trim());
  const nameIdx = header.findIndex((h) =>
    ["full name", "fullname", "name"].includes(h.toLowerCase()),
  );
  const emailIdx = header.findIndex((h) =>
    ["email (fill in)", "email", "roster email"].includes(h.toLowerCase()),
  );

  if (nameIdx < 0 || emailIdx < 0) {
    throw new Error(
      'CSV needs name ("Full name") and email ("Email" or "Email (fill in)") columns.',
    );
  }

  const map = new Map();
  for (const row of rows.slice(1)) {
    const name = String(row[nameIdx] || "").trim();
    const email = String(row[emailIdx] || "").trim();
    if (!name || !isEmail(email)) continue;
    map.set(normalizeName(name), email);
  }
  return map;
}

async function main() {
  const fileArg = process.argv.find((arg) => !arg.startsWith("-") && arg.endsWith(".csv"));
  if (!fileArg) {
    console.error("Usage: node scripts/import-emails.js <file.csv> [--apply]");
    process.exit(1);
  }

  const filePath = path.resolve(fileArg);
  const importMap = loadImportMap(filePath);
  console.log(`Loaded ${importMap.size} email(s) from ${path.basename(filePath)}.`);

  const loaded = await loadRealDataRecords({ write: APPLY });
  const byName = new Map();
  for (const record of loaded.records) {
    byName.set(normalizeName(record.person.fullName), record);
  }

  const toUpdate = [];
  let skippedHasEmail = 0;
  let unmatched = 0;

  for (const [key, email] of importMap.entries()) {
    const record = byName.get(key);
    if (!record) {
      unmatched += 1;
      continue;
    }
    if (record.person.email?.trim()) {
      skippedHasEmail += 1;
      continue;
    }
    const updated = cloneRecord(record);
    updated.person.email = email;
    toUpdate.push(updated);
  }

  console.log(`Will update: ${toUpdate.length}`);
  console.log(`Skipped (already has email): ${skippedHasEmail}`);
  console.log(`Unmatched names in CSV: ${unmatched}`);
  for (const record of toUpdate) {
    console.log(`  ${record.person.fullName} → ${record.person.email}`);
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply.");
    return;
  }

  for (let i = 0; i < toUpdate.length; i += 1) {
    await upsertRealDataRecord(loaded.sheets, loaded.sheetName, toUpdate[i]);
    if (i < toUpdate.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, WRITE_DELAY_MS));
    }
  }

  console.log(`\n✓ Imported email on ${toUpdate.length} row(s).`);
}

main().catch((error) => {
  console.error("Failed:", error?.message || error);
  process.exit(1);
});
