#!/usr/bin/env node
/**
 * Sync Google Sheet → public/data/database.json
 *
 * Fetches all tabs from the Foresight Map spreadsheet and writes the same
 * structure the app expects. Use before build so the deployed site uses sheet data.
 *
 * Requires: Sheet shared "Anyone with the link can view" (for API key auth).
 * Env: SPREADSHEET_ID, GOOGLE_SHEETS_API_KEY (or GOOGLE_API_KEY)
 *
 *   SPREADSHEET_ID=1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ \
 *   GOOGLE_SHEETS_API_KEY=your-key \
 *   node scripts/sync-sheet-to-json.js
 */

const fs = require("fs").promises;
const path = require("path");
const { google } = require("googleapis");
const {
  SHEET_NAMES,
  PEOPLE_HEADERS,
  TRAVEL_WINDOWS_HEADERS,
  SUGGESTIONS_HEADERS,
  ADMIN_USERS_HEADERS,
} = require("./sheet-schema.js");

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ";
const API_KEY =
  process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY;

function parseJsonSafe(str, fallback) {
  if (str == null || String(str).trim() === "") return fallback;
  try {
    return JSON.parse(String(str));
  } catch {
    return fallback;
  }
}

function rowToPerson(row) {
  const get = (i) => (row[i] != null ? String(row[i]).trim() : "");
  const idx = (name) => PEOPLE_HEADERS.indexOf(name);
  const focusTags = parseJsonSafe(row[idx("focusTags")], []);
  const lat = parseFloat(row[idx("lat")]);
  const lng = parseFloat(row[idx("lng")]);
  const fellowshipEndYearRaw = row[idx("fellowshipEndYear")];
  const fellowshipEndYear =
    fellowshipEndYearRaw === "" || fellowshipEndYearRaw == null
      ? null
      : parseInt(String(fellowshipEndYearRaw), 10);
  return {
    id: get(row[idx("id")]) || undefined,
    fullName: get(row[idx("fullName")]),
    roleType: get(row[idx("roleType")]) || "Fellow",
    fellowshipCohortYear: parseInt(row[idx("fellowshipCohortYear")], 10) || 0,
    fellowshipEndYear: Number.isNaN(fellowshipEndYear) ? null : fellowshipEndYear,
    affiliationOrInstitution: get(row[idx("affiliationOrInstitution")]) || null,
    focusTags: Array.isArray(focusTags) ? focusTags : [],
    currentCity: get(row[idx("currentCity")]),
    currentCountry: get(row[idx("currentCountry")]),
    currentCoordinates: {
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
    },
    primaryNode: get(row[idx("primaryNode")]) || "Global",
    profileUrl: get(row[idx("profileUrl")]),
    contactUrlOrHandle: get(row[idx("contactUrlOrHandle")]) || null,
    shortProjectTagline: get(row[idx("shortProjectTagline")]),
    expandedProjectDescription: get(row[idx("expandedProjectDescription")]),
    isAlumni: String(row[idx("isAlumni")]).toLowerCase() === "true",
  };
}

function rowToTravelWindow(row) {
  const get = (i) => (row[i] != null ? String(row[i]).trim() : "");
  const idx = (name) => TRAVEL_WINDOWS_HEADERS.indexOf(name);
  const lat = parseFloat(row[idx("lat")]);
  const lng = parseFloat(row[idx("lng")]);
  return {
    id: get(row[idx("id")]),
    personId: get(row[idx("personId")]),
    title: get(row[idx("title")]),
    city: get(row[idx("city")]),
    country: get(row[idx("country")]),
    coordinates: {
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
    },
    startDate: get(row[idx("startDate")]),
    endDate: get(row[idx("endDate")]),
    type: get(row[idx("type")]) || "Other",
    notes: get(row[idx("notes")]),
  };
}

function rowToSuggestion(row) {
  const get = (i) => (row[i] != null ? String(row[i]).trim() : "");
  const idx = (name) => SUGGESTIONS_HEADERS.indexOf(name);
  const payload = parseJsonSafe(row[idx("requestedPayload")], {});
  return {
    id: get(row[idx("id")]),
    personName: get(row[idx("personName")]),
    personEmailOrHandle: get(row[idx("personEmailOrHandle")]),
    requestedChangeType: get(row[idx("requestedChangeType")]),
    requestedPayload: payload,
    createdAt: get(row[idx("createdAt")]),
    status: get(row[idx("status")]) || "Pending",
  };
}

function rowToAdminUser(row) {
  const get = (i) => (row[i] != null ? String(row[i]).trim() : "");
  const idx = (name) => ADMIN_USERS_HEADERS.indexOf(name);
  return {
    id: get(row[idx("id")]),
    displayName: get(row[idx("displayName")]),
    email: get(row[idx("email")]),
    passwordPlaceholder: get(row[idx("passwordPlaceholder")]),
  };
}

function rowsToObjects(rows, headers, rowToEntity) {
  if (!rows || rows.length < 2) return [];
  const [headerRow, ...dataRows] = rows;
  const colIndex = {};
  headers.forEach((h, i) => {
    colIndex[h] = headerRow[i] === h ? i : headerRow.findIndex((c) => String(c).trim() === h);
  });
  return dataRows
    .map((row) => {
      const ordered = headers.map((h) => row[colIndex[h]]);
      return rowToEntity(ordered);
    })
    .filter((e) => e && (e.id != null && e.id !== ""));
}

async function fetchSheetRange(sheets, sheetName, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!${range}`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return res.data.values || [];
}

async function main() {
  if (!API_KEY) {
    console.log(
      "GOOGLE_SHEETS_API_KEY (or GOOGLE_API_KEY) not set — skipping sync; using existing public/data/database.json."
    );
    return;
  }

  const auth = new google.auth.GoogleAuth({ apiKey: API_KEY });
  const sheets = google.sheets({ version: "v4", auth });

  console.log("Fetching sheet:", SPREADSHEET_ID);

  const [peopleRows, twRows, suggestionsRows, adminRows] = await Promise.all([
    fetchSheetRange(sheets, SHEET_NAMES.PEOPLE, "A:Q"),
    fetchSheetRange(sheets, SHEET_NAMES.TRAVEL_WINDOWS, "A:K"),
    fetchSheetRange(sheets, SHEET_NAMES.SUGGESTIONS, "A:G"),
    fetchSheetRange(sheets, SHEET_NAMES.ADMIN_USERS, "A:D"),
  ]);

  const people = rowsToObjects(peopleRows, PEOPLE_HEADERS, (row) => rowToPerson(row));
  const travelWindows = rowsToObjects(twRows, TRAVEL_WINDOWS_HEADERS, (row) =>
    rowToTravelWindow(row)
  );
  const suggestions = rowsToObjects(suggestionsRows, SUGGESTIONS_HEADERS, (row) =>
    rowToSuggestion(row)
  );
  const adminUsers = rowsToObjects(adminRows, ADMIN_USERS_HEADERS, (row) =>
    rowToAdminUser(row)
  );

  const database = {
    people,
    travelWindows,
    suggestions,
    adminUsers,
  };

  const outPath = path.join(__dirname, "../public/data/database.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(database, null, 2), "utf8");

  console.log(
    `Wrote ${outPath}: ${people.length} people, ${travelWindows.length} travel windows, ${suggestions.length} suggestions, ${adminUsers.length} admin users.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
