#!/usr/bin/env node

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const crypto = require("crypto");
const {
  DEFAULT_DIRECTORY_PASSWORD,
  authenticateDirectoryLogin,
  changeDirectoryPassword,
} = require("../server/directory-auth");
const {
  loadRealDataRecords,
  cloneRecord,
  upsertRealDataRecord,
  normalizeName,
} = require("../server/realdata-store");

async function main() {
  const loaded = await loadRealDataRecords({ write: true });
  const idCounts = new Map();
  const nameCounts = new Map();
  loaded.records.forEach((record) => {
    const id = String(record.person.id || "").trim();
    const normalizedName = normalizeName(record.person.fullName);
    if (!id) return;
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
    if (normalizedName) {
      nameCounts.set(normalizedName, (nameCounts.get(normalizedName) || 0) + 1);
    }
  });

  const target = loaded.records.find((record) => {
    const id = String(record.person.id || "").trim();
    const normalizedName = normalizeName(record.person.fullName);
    return (
      id &&
      idCounts.get(id) === 1 &&
      normalizedName &&
      nameCounts.get(normalizedName) === 1 &&
      record.person.fullName &&
      !record.auth.passwordHash
    );
  });

  if (!target) {
    throw new Error(
      "Could not find an unclaimed uniquely identifiable RealData row for auth testing.",
    );
  }

  const original = cloneRecord(target);
  const tempPassword = `Tmp-${crypto.randomBytes(6).toString("hex")}`;

  try {
    console.log(`Testing member auth flow with ${target.person.fullName} …`);

    const login = await authenticateDirectoryLogin(
      target.person.fullName,
      DEFAULT_DIRECTORY_PASSWORD,
    );
    if (!login.auth.mustChangePassword) {
      throw new Error("Expected first-login session to require password change.");
    }

    const changed = await changeDirectoryPassword(
      login.auth.token,
      DEFAULT_DIRECTORY_PASSWORD,
      tempPassword,
    );
    if (changed.auth.mustChangePassword) {
      throw new Error("Password change did not clear mustChangePassword.");
    }

    let relogin = null;
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        relogin = await authenticateDirectoryLogin(
          target.person.fullName,
          tempPassword,
        );
        break;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!relogin) {
      throw lastError || new Error("Re-login failed after password change.");
    }

    if (relogin.person.id !== target.person.id) {
      throw new Error("Re-login resolved to the wrong person.");
    }

    console.log(
      `Success: first-login auth and password change worked for ${target.person.id}.`,
    );
  } finally {
    console.log("Restoring original auth fields …");
    await upsertRealDataRecord(loaded.sheets, loaded.sheetName, original);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
