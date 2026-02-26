#!/usr/bin/env node
/**
 * Test: write all people (and related) data to the Google Sheet, then sync back
 * and verify. Proves the sheet read/write pipeline works.
 *
 * Requires: GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS
 * (same as migrate:sheet). Sheet must be shared with the service account as Editor.
 * For sync back: GOOGLE_SHEETS_API_KEY and sheet shared "Anyone with the link can view".
 *
 * Run: pnpm run test:sheet-roundtrip
 *
 * 1. Backs up public/data/database.json
 * 2. Runs migrate (database.json → sheet)
 * 3. Runs sync (sheet → database.json)
 * 4. Verifies people/travelWindows counts and sample ids
 * 5. Restores backup (so your repo stays in pre-test state)
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs").promises;
const path = require("path");
const { execSync } = require("child_process");

const DB_PATH = path.join(__dirname, "../public/data/database.json");
const BACKUP_PATH = path.join(__dirname, "../public/data/database.json.bak");

function hasServiceAccount() {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

function hasApiKey() {
  return !!(process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY);
}

async function main() {
  if (!hasServiceAccount()) {
    console.error("Missing Service Account credentials. Add to .env.local:\n");
    console.error("  GOOGLE_SERVICE_ACCOUNT_KEY='{\"type\":\"service_account\",\"project_id\":\"...\",\"private_key\":\"...\",...}'");
    console.error("  or  GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json\n");
    console.error("Then share the sheet with the service account email as Editor.");
    process.exit(1);
  }

  if (!hasApiKey()) {
    console.error("Missing GOOGLE_SHEETS_API_KEY. Needed to sync sheet → JSON after write.");
    console.error("Add it to .env.local and ensure the sheet is shared 'Anyone with the link can view'.");
    process.exit(1);
  }

  const raw = await fs.readFile(DB_PATH, "utf8");
  const before = JSON.parse(raw);
  const peopleCount = (before.people || []).length;
  const travelWindowsCount = (before.travelWindows || []).length;
  const firstPersonId = before.people?.[0]?.id;
  const lastPersonId = before.people?.[before.people?.length - 1]?.id;

  console.log("Backing up database.json …");
  await fs.writeFile(BACKUP_PATH, raw, "utf8");

  console.log("Step 1: Writing to sheet (migrate:sheet) …");
  execSync("pnpm run migrate:sheet", {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
    env: process.env,
  });

  console.log("Step 2: Syncing sheet → database.json …");
  execSync("pnpm run sync:sheet", {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
    env: process.env,
  });

  const afterRaw = await fs.readFile(DB_PATH, "utf8");
  const after = JSON.parse(afterRaw);
  const afterPeopleCount = (after.people || []).length;
  const afterTwCount = (after.travelWindows || []).length;

  console.log("Step 3: Verifying round-trip …");
  const ok =
    afterPeopleCount === peopleCount &&
    afterTwCount === travelWindowsCount &&
    after.people?.[0]?.id === firstPersonId &&
    after.people?.[after.people.length - 1]?.id === lastPersonId;

  console.log("Restoring database.json from backup …");
  await fs.writeFile(DB_PATH, raw, "utf8");
  await fs.unlink(BACKUP_PATH).catch(() => {});

  if (!ok) {
    console.error("\nRound-trip check failed:");
    console.error(`  People: expected ${peopleCount}, got ${afterPeopleCount}`);
    console.error(`  Travel windows: expected ${travelWindowsCount}, got ${afterTwCount}`);
    console.error(`  First id: expected ${firstPersonId}, got ${after.people?.[0]?.id}`);
    console.error(`  Last id: expected ${lastPersonId}, got ${after.people?.[after.people?.length - 1]?.id}`);
    process.exit(1);
  }

  console.log(`\nSuccess: ${peopleCount} people and ${travelWindowsCount} travel windows wrote to the sheet and synced back.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
