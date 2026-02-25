#!/usr/bin/env node
/**
 * One-time migration: public/data/database.json → Google Sheet
 *
 * Overwrites the People, TravelWindows, Suggestions, and AdminUsers tabs with
 * data from the local database.json. Creates/updates the sheet structure.
 *
 * Requires write access: use a Service Account.
 * 1. Create a service account in Google Cloud, enable Google Sheets API.
 * 2. Download the JSON key; set GOOGLE_APPLICATION_CREDENTIALS to its path.
 * 3. Share the target spreadsheet with the service account email (e.g. xxx@project.iam.gserviceaccount.com) as Editor.
 *
 * Env: SPREADSHEET_ID, GOOGLE_APPLICATION_CREDENTIALS (path to key JSON)
 *
 *   SPREADSHEET_ID=1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ \
 *   GOOGLE_APPLICATION_CREDENTIALS=./path-to-key.json \
 *   node scripts/migrate-json-to-sheet.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs").promises;
const path = require("path");
const { google } = require("googleapis");
const {
  SHEET_NAMES,
  PEOPLE_HEADERS,
  TRAVEL_WINDOWS_HEADERS,
  SUGGESTIONS_HEADERS,
  ADMIN_USERS_HEADERS,
  RSVPS_HEADERS,
} = require("./sheet-schema.js");

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ";

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
  return [
    a.id ?? "",
    a.displayName ?? "",
    a.email ?? "",
    a.passwordPlaceholder ?? "",
  ];
}

async function ensureSheets(sheets) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const existing = (meta.data.sheets || []).map((s) => s.properties.title);
  const required = [
    SHEET_NAMES.PEOPLE,
    SHEET_NAMES.TRAVEL_WINDOWS,
    SHEET_NAMES.SUGGESTIONS,
    SHEET_NAMES.ADMIN_USERS,
    SHEET_NAMES.RSVPS,
  ];
  const missing = required.filter((t) => !existing.includes(t));
  if (missing.length === 0) return;

  const requests = missing.map((title) => ({
    addSheet: { properties: { title } },
  }));
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
  console.log("Created tabs:", missing.join(", "));
}

async function writeSheet(sheets, sheetName, headers, rows) {
  const range = `'${sheetName}'!A1`;
  const data = [headers, ...rows];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: data },
  });
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A${data.length + 1}:ZZ10000`,
  }).catch(() => {});
}

async function main() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  let key;
  if (keyJson) {
    key = JSON.parse(keyJson);
  } else if (keyPath) {
    key = JSON.parse(await fs.readFile(path.resolve(keyPath), "utf8"));
  } else {
    console.error(
      "Set GOOGLE_SERVICE_ACCOUNT_KEY (JSON string) or GOOGLE_APPLICATION_CREDENTIALS (file path) " +
      "to your service account key. Share the sheet with the account's email as Editor."
    );
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const dbPath = path.join(__dirname, "../public/data/database.json");
  const raw = await fs.readFile(dbPath, "utf8");
  const database = JSON.parse(raw);

  const people = database.people || [];
  const travelWindows = database.travelWindows || [];
  const suggestions = database.suggestions || [];
  const adminUsers = database.adminUsers || [];
  const rsvps = database.rsvps || [];

  await ensureSheets(sheets);

  await writeSheet(
    sheets,
    SHEET_NAMES.PEOPLE,
    PEOPLE_HEADERS,
    people.map(personToRow)
  );
  await writeSheet(
    sheets,
    SHEET_NAMES.TRAVEL_WINDOWS,
    TRAVEL_WINDOWS_HEADERS,
    travelWindows.map(travelWindowToRow)
  );
  await writeSheet(
    sheets,
    SHEET_NAMES.SUGGESTIONS,
    SUGGESTIONS_HEADERS,
    suggestions.map(suggestionToRow)
  );
  await writeSheet(
    sheets,
    SHEET_NAMES.ADMIN_USERS,
    ADMIN_USERS_HEADERS,
    adminUsers.map(adminUserToRow)
  );
  const rsvpToRow = (r) => [
    r.eventId ?? "",
    r.personId ?? "",
    r.fullName ?? "",
    r.status ?? "going",
    r.createdAt ?? "",
    r.updatedAt ?? "",
  ];
  await writeSheet(
    sheets,
    SHEET_NAMES.RSVPS,
    RSVPS_HEADERS,
    rsvps.map(rsvpToRow)
  );

  console.log(
    `Migrated to sheet ${SPREADSHEET_ID}: ${people.length} people, ${travelWindows.length} travel windows, ${suggestions.length} suggestions, ${adminUsers.length} admin users, ${rsvps.length} RSVPs.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
