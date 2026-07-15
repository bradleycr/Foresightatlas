#!/usr/bin/env node
/**
 * Add Aurélien Nicolas (Berlin AI Node / Nodee) to RealData and mint a claim link.
 *
 *   node scripts/add-aurelien-nicolas.js           # dry run
 *   node scripts/add-aurelien-nicolas.js --apply   # write + mint claim link
 */

require("dotenv").config({ path: ".env.local", quiet: true });
require("dotenv").config({ quiet: true });

const {
  getSpreadsheetId,
  PEOPLE_SHEET_WIDTH,
} = require("./sheet-schema");
const {
  loadRealDataRecords,
  buildStablePersonId,
  personRecordToRow,
  cloneRecord,
} = require("../server/realdata-store");
const { issueClaimToken } = require("../server/directory-auth");

const FULL_NAME = "Aurélien Nicolas";
const TITLE = "CTO, Inversed Tech · Berlin AI Node";

const fold = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function buildClaimUrl(base, token) {
  const trimmed = String(base || "").replace(/\/+$/, "");
  const query = `claim?token=${encodeURIComponent(token)}`;
  if (!trimmed) return `/${query}`;
  return `${trimmed}/${query}`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const loaded = await loadRealDataRecords({ write: apply });
  const existing = loaded.records.find((r) => fold(r.person.fullName) === fold(FULL_NAME));

  let personId;

  if (existing) {
    personId = existing.person.id;
    const updated = cloneRecord(existing);
    let changed = false;

    if (updated.person.roleType !== "Nodee") {
      updated.person.roleType = "Nodee";
      updated.person.roleTypes = ["Nodee"];
      changed = true;
    }
    if (!updated.person.shortProjectTagline) {
      updated.person.shortProjectTagline = TITLE;
      changed = true;
    }
    if (!updated.person.affiliationOrInstitution) {
      updated.person.affiliationOrInstitution = "Inversed Tech";
      changed = true;
    }
    if (updated.person.primaryNode !== "Berlin Node") {
      updated.person.primaryNode = "Berlin Node";
      changed = true;
    }
    if (!updated.person.currentCity) {
      updated.person.currentCity = "Berlin";
      changed = true;
    }
    if (!updated.person.currentCountry) {
      updated.person.currentCountry = "Germany";
      changed = true;
    }
    if (!updated.person.currentCoordinates) {
      updated.person.currentCoordinates = { lat: 52.52, lng: 13.405 };
      changed = true;
    }
    if (!(updated.person.focusTags || []).includes("Secure AI")) {
      updated.person.focusTags = [...(updated.person.focusTags || []), "Secure AI"];
      changed = true;
    }

    if (changed && apply) {
      await loaded.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: getSpreadsheetId(),
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: [
            {
              range: `'${loaded.sheetName}'!A${updated.rowNumber}:${PEOPLE_SHEET_WIDTH}${updated.rowNumber}`,
              values: [personRecordToRow(updated)],
            },
          ],
        },
      });
      console.log(`✓ Updated existing row for ${FULL_NAME} (row ${updated.rowNumber}).`);
    } else {
      console.log(`OK  ${FULL_NAME} already in sheet (row ${existing.rowNumber}).`);
    }
  } else {
    const person = {
      id: "",
      fullName: FULL_NAME,
      roleType: "Nodee",
      roleTypes: ["Nodee"],
      fellowshipCohortYear: 0,
      fellowshipEndYear: null,
      affiliationOrInstitution: "Inversed Tech",
      focusTags: ["Secure AI"],
      currentCity: "Berlin",
      currentCountry: "Germany",
      currentCoordinates: { lat: 52.52, lng: 13.405 },
      primaryNode: "Berlin Node",
      profileUrl: "https://www.linkedin.com/in/aureliennicolas",
      profileImageUrl: "",
      contactUrlOrHandle: "",
      calendarEmail: "",
      availabilityUrl: "",
      shortProjectTagline: TITLE,
      expandedProjectDescription:
        "CTO at Inversed Tech. Cryptographic identity and verifiable trust for autonomous AI agents (Threshold / MPC).",
      isAlumni: false,
      isPrivate: false,
      email: "",
    };
    person.id = buildStablePersonId(person, Date.now());
    personId = person.id;

    console.log(`ADD ${FULL_NAME} — ${TITLE} (role: Nodee)`);

    if (!apply) {
      console.log("\nDRY RUN — re-run with --apply to write and mint claim link.");
      return;
    }

    await loaded.sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: `'${loaded.sheetName}'!A:${PEOPLE_SHEET_WIDTH}`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [personRecordToRow({ person, auth: {} })] },
    });
    console.log(`✓ Added ${FULL_NAME} to the sheet.`);
  }

  if (!apply) return;

  const base = process.env.CLAIM_BASE_URL || "https://foresightatlas.vercel.app";
  const token = issueClaimToken(personId);
  const url = buildClaimUrl(base, token);

  console.log(`\n--- ${FULL_NAME} claim link ---`);
  console.log(url);
  console.log("\nSend this link privately. It works once to set their password.");
  console.log("Tip: if you have their email, paste it into the RealData email column so self-serve resets work later.");
}

main().catch((error) => {
  console.error("Failed:", error?.message || error);
  process.exit(1);
});
