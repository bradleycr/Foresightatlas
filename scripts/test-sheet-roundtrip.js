#!/usr/bin/env node
/**
 * Safer sheet roundtrip verification.
 *
 * Instead of overwriting the full sheet, this script:
 * 1. Backs up `public/data/database.json`
 * 2. Loads one canonical RealData profile row
 * 3. Writes a temporary profile change through `saveProfile()`
 * 4. Runs `sync:sheet`
 * 5. Verifies the updated record round-trips back into `database.json`
 * 6. Restores the original profile row and local JSON
 *
 * This proves the profile writeback path works without clobbering the entire sheet.
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs").promises;
const path = require("path");
const { execSync } = require("child_process");
const { loadRealDataRecords } = require("../server/realdata-store");
const { saveProfile } = require("../server/profile-store");

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

  const loaded = await loadRealDataRecords({ write: true });
  const idCounts = new Map();
  loaded.records.forEach((record) => {
    const id = String(record.person.id || "").trim();
    if (!id) return;
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  });

  const target = loaded.records.find((record) => {
    const id = String(record.person.id || "").trim();
    return id && idCounts.get(id) === 1 && record.person.fullName;
  });
  if (!target) {
    throw new Error("Could not find a uniquely identifiable RealData row to use for roundtrip testing.");
  }

  const originalPerson = { ...target.person };
  const originalTagline = originalPerson.shortProjectTagline;
  const marker = `[roundtrip ${Date.now()}]`;
  const updatedPerson = {
    ...originalPerson,
    shortProjectTagline: originalTagline
      ? `${originalTagline} ${marker}`.trim()
      : marker,
  };
  const authContext = {
    personId: originalPerson.id,
    fullName: originalPerson.fullName,
    mustChangePassword: false,
  };

  console.log("Backing up database.json …");
  await fs.writeFile(BACKUP_PATH, raw, "utf8");

  try {
    console.log(`Step 1: Writing temporary profile update for ${originalPerson.fullName} …`);
    await saveProfile(updatedPerson, authContext);

    console.log("Step 2: Syncing sheet → database.json …");
    execSync("pnpm run sync:sheet", {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
      env: process.env,
    });

    const afterRaw = await fs.readFile(DB_PATH, "utf8");
    const after = JSON.parse(afterRaw);
    const afterPeopleCount = (after.people || []).length;
    const syncedPerson = (after.people || []).find((person) => person.id === originalPerson.id);

    console.log("Step 3: Verifying round-trip …");
    const ok =
      afterPeopleCount === loaded.records.length &&
      syncedPerson &&
      syncedPerson.shortProjectTagline === updatedPerson.shortProjectTagline;

    if (!ok) {
      console.error("\nRound-trip check failed:");
      console.error(`  People: expected ${loaded.records.length}, got ${afterPeopleCount}`);
      console.error(
        `  Synced tagline: expected ${updatedPerson.shortProjectTagline}, got ${syncedPerson?.shortProjectTagline}`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        `\nSuccess: profile writeback for ${originalPerson.id} round-tripped through RealData and back into database.json.`,
      );
    }
  } finally {
    console.log("Restoring original profile row …");
    await saveProfile(originalPerson, authContext).catch((error) => {
      console.error("Failed to restore original RealData row:", error);
      process.exitCode = 1;
    });

    console.log("Restoring database.json from backup …");
    await fs.writeFile(DB_PATH, raw, "utf8");
    await fs.unlink(BACKUP_PATH).catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
