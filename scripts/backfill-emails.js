#!/usr/bin/env node
/**
 * Backfill the server-side `email` column on RealData when it's empty but
 * another field already holds a valid address (contactUrlOrHandle or
 * calendarEmail). Never overwrites an existing roster email.
 *
 *   node scripts/backfill-emails.js            # dry run
 *   node scripts/backfill-emails.js --apply  # write to sheet
 */

require("dotenv").config({ path: ".env.local", quiet: true });
require("dotenv").config({ quiet: true });

const {
  loadRealDataRecords,
  cloneRecord,
  upsertRealDataRecord,
} = require("../server/realdata-store");

const APPLY = process.argv.includes("--apply");
const WRITE_DELAY_MS = 1200;

function isEmail(value) {
  const s = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 120;
}

function pickEmail(person) {
  const candidates = [person.contactUrlOrHandle, person.calendarEmail];
  return candidates.map((v) => String(v || "").trim()).find(isEmail) || null;
}

async function main() {
  const loaded = await loadRealDataRecords({ write: APPLY });
  const toUpdate = [];

  for (const record of loaded.records) {
    if (record.person.email?.trim()) continue;
    const email = pickEmail(record.person);
    if (!email) continue;
    const updated = cloneRecord(record);
    updated.person.email = email;
    toUpdate.push({ record: updated, email });
  }

  console.log(
    `${toUpdate.length} row(s) can backfill email from contact/calendar fields.`,
  );
  for (const { record, email } of toUpdate) {
    console.log(`  ${record.person.fullName} → ${email}`);
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply.");
    return;
  }

  for (let i = 0; i < toUpdate.length; i += 1) {
    await upsertRealDataRecord(
      loaded.sheets,
      loaded.sheetName,
      toUpdate[i].record,
    );
    if (i < toUpdate.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, WRITE_DELAY_MS));
    }
  }

  console.log(`\n✓ Back-filled email on ${toUpdate.length} row(s).`);
}

main().catch((error) => {
  console.error("Failed:", error?.message || error);
  process.exit(1);
});
