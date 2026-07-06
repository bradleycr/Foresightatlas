#!/usr/bin/env node
/**
 * Seed the Foresight Institute staff/team into the RealData sheet.
 *
 * Source of truth: https://foresight.org/about/ (names, titles, photos).
 * Idempotent: existing rows (matched by diacritic-folded name) are only
 * back-filled — never overwritten — so re-running is safe. New rows are
 * appended with roleType "Foresight Team", public by default.
 *
 * Usage:
 *   node scripts/add-foresight-team.js           # dry run
 *   node scripts/add-foresight-team.js --apply   # write to the sheet
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

const IMG = (path) => `https://foresight.org/wp-content/uploads/${path}`;

/** Team roster as listed on the About page (photos are the page's own assets). */
const TEAM = [
  { fullName: "Allison Duettmann", title: "CEO", img: IMG("2025/08/Allison-Duettman-t.png") },
  { fullName: "Karolina Eklöw", title: "COO", img: IMG("2025/08/Karolina-t.png") },
  { fullName: "Boston Nyer", title: "CFO (Fractional)", img: IMG("2025/08/Boston-Nyer-t.png") },
  { fullName: "Beatrice Erkers", title: "Program Director, Existential Hope", img: IMG("2025/08/Beatrice-Erkers.png") },
  { fullName: "Lydia La Roux", title: "Program Manager, Events & Fellowship", img: IMG("2025/08/lydia-t.png") },
  { fullName: "Amber Duettmann", title: "Advisor", img: IMG("2025/08/Amber-t.png") },
  { fullName: "Lisa Stenvinkel", title: "Interim Communications Manager", img: IMG("2026/04/Lisa-Stenvinkel-t.png") },
  { fullName: "Madeleine Parker", title: "Program Director, Strategy and Development", img: IMG("2026/03/Madeleine-Parker.png") },
  { fullName: "Bradley Clark Royes", title: "AI Node Manager, Berlin", img: IMG("2025/12/Bradley-t.png") },
  { fullName: "Rachel Farley", title: "Node Manager, San Francisco", img: "" },
  { fullName: "Martina Pepiciello", title: "Communications Specialist, Existential Hope", img: IMG("2025/12/Martina-t.png") },
  { fullName: "Tara Padovan-Hickman", title: "Executive Assistant to CEO", img: IMG("2025/12/Tara-t.png") },
  { fullName: "Kristy Hilands", title: "Special Projects (Advisor)", img: IMG("2026/01/Kristy-t.png") },
  { fullName: "Sherry Hull", title: "Administrative Manager", img: IMG("2026/03/Sherry-t.png") },
];

const fold = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Prefer the full-size photo; fall back to the page's 240px thumb if missing. */
async function resolveImage(url) {
  const head = async (u) => {
    try {
      const res = await fetch(u, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  };
  if (await head(url)) return url;
  const thumb = url.replace(/\.png$/, "-240x240.png");
  if (await head(thumb)) return thumb;
  return "";
}

async function main() {
  const apply = process.argv.includes("--apply");
  const loaded = await loadRealDataRecords({ write: apply });
  const byName = new Map();
  for (const r of loaded.records) {
    const key = fold(r.person.fullName);
    if (!byName.has(key)) byName.set(key, r);
  }

  const toAdd = [];
  const toUpdate = [];

  for (const member of TEAM) {
    const img = await resolveImage(member.img);
    const existing = byName.get(fold(member.fullName));

    if (existing) {
      // Back-fill only what's empty; a member's own edits always win.
      const updated = cloneRecord(existing);
      const fills = [];
      if (!updated.person.profileImageUrl && img) {
        updated.person.profileImageUrl = img;
        fills.push("photo");
      }
      if (!updated.person.shortProjectTagline) {
        updated.person.shortProjectTagline = member.title;
        fills.push("title");
      }
      if (!updated.person.affiliationOrInstitution) {
        updated.person.affiliationOrInstitution = "Foresight Institute";
        fills.push("affiliation");
      }
      if (fills.length) {
        toUpdate.push({ record: updated, fills });
        console.log(`FILL   ${member.fullName} (row ${existing.rowNumber}): ${fills.join(", ")}`);
      } else {
        console.log(`OK     ${member.fullName} (row ${existing.rowNumber}) — nothing to fill`);
      }
      continue;
    }

    const person = {
      id: "",
      fullName: member.fullName,
      roleType: "Foresight Team",
      fellowshipCohortYear: 0,
      fellowshipEndYear: null,
      affiliationOrInstitution: "Foresight Institute",
      focusTags: [],
      currentCity: "",
      currentCountry: "",
      currentCoordinates: { lat: 0, lng: 0 },
      primaryNode: "Global",
      profileUrl: "https://foresight.org/about/",
      profileImageUrl: img,
      contactUrlOrHandle: "",
      calendarEmail: "",
      availabilityUrl: "",
      shortProjectTagline: member.title,
      expandedProjectDescription: "",
      isAlumni: false,
      isPrivate: false,
      email: "",
    };
    person.id = buildStablePersonId(person, Date.now());
    toAdd.push({ person, auth: {} });
    console.log(`ADD    ${member.fullName} — ${member.title}${img ? " (+photo)" : " (no photo found)"}`);
  }

  console.log(`\n${toAdd.length} to add, ${toUpdate.length} to back-fill.`);

  if (!apply) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply.");
    return;
  }

  const spreadsheetId = getSpreadsheetId();
  const sheetName = loaded.sheetName;

  if (toUpdate.length) {
    await loaded.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: toUpdate.map((u) => ({
          range: `'${sheetName}'!A${u.record.rowNumber}:${PEOPLE_SHEET_WIDTH}${u.record.rowNumber}`,
          values: [personRecordToRow(u.record)],
        })),
      },
    });
    console.log(`✓ Back-filled ${toUpdate.length} row(s).`);
  }

  if (toAdd.length) {
    await loaded.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${sheetName}'!A:${PEOPLE_SHEET_WIDTH}`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: toAdd.map((r) => personRecordToRow(r)) },
    });
    console.log(`✓ Added ${toAdd.length} new row(s).`);
  }
}

main().catch((error) => {
  console.error("Failed:", error?.message || error);
  process.exit(1);
});
