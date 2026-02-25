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
    id: get(idx("id")) || undefined,
    fullName: get(idx("fullName")),
    roleType: get(idx("roleType")) || "Fellow",
    fellowshipCohortYear: parseInt(row[idx("fellowshipCohortYear")], 10) || 0,
    fellowshipEndYear: Number.isNaN(fellowshipEndYear) ? null : fellowshipEndYear,
    affiliationOrInstitution: get(idx("affiliationOrInstitution")) || null,
    focusTags: Array.isArray(focusTags) ? focusTags : [],
    currentCity: get(idx("currentCity")),
    currentCountry: get(idx("currentCountry")),
    currentCoordinates: {
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
    },
    primaryNode: get(idx("primaryNode")) || "Global",
    profileUrl: get(idx("profileUrl")),
    contactUrlOrHandle: get(idx("contactUrlOrHandle")) || null,
    shortProjectTagline: get(idx("shortProjectTagline")),
    expandedProjectDescription: get(idx("expandedProjectDescription")),
    isAlumni: String(row[idx("isAlumni")]).toLowerCase() === "true",
  };
}

function rowToTravelWindow(row) {
  const get = (i) => (row[i] != null ? String(row[i]).trim() : "");
  const idx = (name) => TRAVEL_WINDOWS_HEADERS.indexOf(name);
  const lat = parseFloat(row[idx("lat")]);
  const lng = parseFloat(row[idx("lng")]);
  return {
    id: get(idx("id")),
    personId: get(idx("personId")),
    title: get(idx("title")),
    city: get(idx("city")),
    country: get(idx("country")),
    coordinates: {
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
    },
    startDate: get(idx("startDate")),
    endDate: get(idx("endDate")),
    type: get(idx("type")) || "Other",
    notes: get(idx("notes")),
  };
}

function rowToSuggestion(row) {
  const get = (i) => (row[i] != null ? String(row[i]).trim() : "");
  const idx = (name) => SUGGESTIONS_HEADERS.indexOf(name);
  const payload = parseJsonSafe(row[idx("requestedPayload")], {});
  return {
    id: get(idx("id")),
    personName: get(idx("personName")),
    personEmailOrHandle: get(idx("personEmailOrHandle")),
    requestedChangeType: get(idx("requestedChangeType")),
    requestedPayload: payload,
    createdAt: get(idx("createdAt")),
    status: get(idx("status")) || "Pending",
  };
}

function rowToAdminUser(row) {
  const get = (i) => (row[i] != null ? String(row[i]).trim() : "");
  const idx = (name) => ADMIN_USERS_HEADERS.indexOf(name);
  return {
    id: get(idx("id")),
    displayName: get(idx("displayName")),
    email: get(idx("email")),
    passwordPlaceholder: get(idx("passwordPlaceholder")),
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
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!${range}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    return res.data.values || [];
  } catch (err) {
    if (err.code === 400 && err.message?.includes("Unable to parse range")) {
      console.warn(`Tab '${sheetName}' not found in spreadsheet — skipping.`);
      return [];
    }
    throw err;
  }
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
