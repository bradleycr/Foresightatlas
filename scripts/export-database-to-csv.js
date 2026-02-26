#!/usr/bin/env node
/**
 * Export public/data/database.json → CSV files for pasting into the Google Sheet.
 *
 * Run: node scripts/export-database-to-csv.js
 *
 * Writes to scripts/sheet-export/ (created if missing):
 *   People.csv, TravelWindows.csv, Suggestions.csv, AdminUsers.csv, RSVPs.csv
 *
 * Open each CSV and paste into the corresponding tab of the Foresight Map Database
 * sheet (row 1 = headers, data from row 2). Or use File → Import in Sheets.
 *
 * Optional: --sample — export only first 5 people and 5 travel windows for quick testing.
 */

const fs = require("fs").promises;
const path = require("path");
const {
  PEOPLE_HEADERS,
  TRAVEL_WINDOWS_HEADERS,
  SUGGESTIONS_HEADERS,
  ADMIN_USERS_HEADERS,
  RSVPS_HEADERS,
} = require("./sheet-schema.js");

const OUT_DIR = path.join(__dirname, "sheet-export");
const SAMPLE = process.argv.includes("--sample");

/** Escape a cell for CSV: wrap in quotes if needed, double internal quotes. */
function csvEscape(val) {
  const s = val == null ? "" : String(val);
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function personToRow(p) {
  return [
    p.id ?? "",
    p.fullName ?? "",
    p.roleType ?? "Fellow",
    p.fellowshipCohortYear ?? "",
    p.fellowshipEndYear ?? "",
    p.affiliationOrInstitution ?? "",
    JSON.stringify(p.focusTags ?? []),
    p.currentCity ?? "",
    p.currentCountry ?? "",
    (p.currentCoordinates && p.currentCoordinates.lat) ?? "",
    (p.currentCoordinates && p.currentCoordinates.lng) ?? "",
    p.primaryNode ?? "Global",
    p.profileUrl ?? "",
    p.contactUrlOrHandle ?? "",
    p.shortProjectTagline ?? "",
    p.expandedProjectDescription ?? "",
    p.isAlumni === true ? "TRUE" : "FALSE",
  ];
}

function travelWindowToRow(tw) {
  const coords = tw.coordinates || {};
  return [
    tw.id ?? "",
    tw.personId ?? "",
    tw.title ?? "",
    tw.city ?? "",
    tw.country ?? "",
    coords.lat ?? "",
    coords.lng ?? "",
    tw.startDate ?? "",
    tw.endDate ?? "",
    tw.type ?? "Other",
    tw.notes ?? "",
  ];
}

function suggestionToRow(s) {
  return [
    s.id ?? "",
    s.personName ?? "",
    s.personEmailOrHandle ?? "",
    s.requestedChangeType ?? "",
    typeof s.requestedPayload === "object"
      ? JSON.stringify(s.requestedPayload)
      : String(s.requestedPayload ?? ""),
    s.createdAt ?? "",
    s.status ?? "Pending",
  ];
}

function adminUserToRow(a) {
  return [a.id ?? "", a.displayName ?? "", a.email ?? "", a.passwordPlaceholder ?? ""];
}

function rsvpToRow(r) {
  return [
    r.eventId ?? "",
    r.eventTitle ?? "",
    r.personId ?? "",
    r.fullName ?? "",
    r.status ?? "going",
    r.createdAt ?? "",
    r.updatedAt ?? "",
  ];
}

function toCsv(headers, rows) {
  const headerLine = headers.map(csvEscape).join(",");
  const dataLines = rows.map((row) => row.map(csvEscape).join(","));
  return [headerLine, ...dataLines].join("\n");
}

async function main() {
  const dbPath = path.join(__dirname, "../public/data/database.json");
  const raw = await fs.readFile(dbPath, "utf8");
  const database = JSON.parse(raw);

  let people = database.people || [];
  let travelWindows = database.travelWindows || [];
  const suggestions = database.suggestions || [];
  const adminUsers = database.adminUsers || [];
  const rsvps = database.rsvps || [];

  if (SAMPLE) {
    people = people.slice(0, 5);
    travelWindows = travelWindows.slice(0, 5);
    console.log("Sample mode: exporting 5 people, 5 travel windows.");
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const files = [
    [path.join(OUT_DIR, "People.csv"), PEOPLE_HEADERS, people.map(personToRow)],
    [
      path.join(OUT_DIR, "TravelWindows.csv"),
      TRAVEL_WINDOWS_HEADERS,
      travelWindows.map(travelWindowToRow),
    ],
    [
      path.join(OUT_DIR, "Suggestions.csv"),
      SUGGESTIONS_HEADERS,
      suggestions.map(suggestionToRow),
    ],
    [
      path.join(OUT_DIR, "AdminUsers.csv"),
      ADMIN_USERS_HEADERS,
      adminUsers.map(adminUserToRow),
    ],
    [path.join(OUT_DIR, "RSVPs.csv"), RSVPS_HEADERS, rsvps.map(rsvpToRow)],
  ];

  for (const [filePath, headers, rows] of files) {
    const csv = toCsv(headers, rows);
    await fs.writeFile(filePath, csv, "utf8");
    const name = path.basename(filePath);
    console.log(`Wrote ${name} (${rows.length} rows)`);
  }

  console.log(`\nExport directory: ${OUT_DIR}`);
  console.log(
    "Paste each CSV into the matching tab of your Google Sheet (row 1 = header), or use File → Import."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
