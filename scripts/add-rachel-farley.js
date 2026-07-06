#!/usr/bin/env node
/**
 * One-off: add Rachel Farley (SF node manager) to RealData and print her claim link.
 *
 *   node scripts/add-rachel-farley.js           # dry run
 *   node scripts/add-rachel-farley.js --apply   # write + mint claim link
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

const FULL_NAME = "Rachel Farley";
const TITLE = "Node Manager, San Francisco";

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

    if (updated.person.roleType !== "Foresight Team") {
      updated.person.roleType = "Foresight Team";
      changed = true;
    }
    if (!updated.person.shortProjectTagline) {
      updated.person.shortProjectTagline = TITLE;
      changed = true;
    }
    if (!updated.person.affiliationOrInstitution) {
      updated.person.affiliationOrInstitution = "Foresight Institute";
      changed = true;
    }
    if (updated.person.primaryNode !== "Bay Area Node") {
      updated.person.primaryNode = "Bay Area Node";
      changed = true;
    }
    if (updated.person.currentCity !== "San Francisco") {
      updated.person.currentCity = "San Francisco";
      changed = true;
    }
    if (updated.person.currentCountry !== "United States") {
      updated.person.currentCountry = "United States";
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
    } else if (existing) {
      console.log(`OK  ${FULL_NAME} already in sheet (row ${existing.rowNumber}).`);
    }
  } else {
    const person = {
      id: "",
      fullName: FULL_NAME,
      roleType: "Foresight Team",
      fellowshipCohortYear: 0,
      fellowshipEndYear: null,
      affiliationOrInstitution: "Foresight Institute",
      focusTags: [],
      currentCity: "San Francisco",
      currentCountry: "United States",
      currentCoordinates: { lat: 37.7749, lng: -122.4194 },
      primaryNode: "Bay Area Node",
      profileUrl: "https://foresight.org/about/",
      profileImageUrl: "",
      contactUrlOrHandle: "",
      calendarEmail: "",
      availabilityUrl: "",
      shortProjectTagline: TITLE,
      expandedProjectDescription: "",
      isAlumni: false,
      isPrivate: false,
      email: "",
    };
    person.id = buildStablePersonId(person, Date.now());
    personId = person.id;

    console.log(`ADD ${FULL_NAME} — ${TITLE}`);

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

  console.log("\n--- Rachel Farley claim link ---");
  console.log(url);
  console.log("\nSend this link privately. It works once to set her password.");
}

main().catch((error) => {
  console.error("Failed:", error?.message || error);
  process.exit(1);
});
