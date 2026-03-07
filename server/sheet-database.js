"use strict";

/**
 * Load the full database (people, travel windows, suggestions, admin users, RSVPs)
 * from the Google Sheet. Used by GET /api/database so the app uses the sheet as
 * the live source of truth. Requires GOOGLE_SHEETS_API_KEY or GOOGLE_SERVICE_ACCOUNT_KEY.
 */

const {
  getSheetsClient,
  loadRealDataRecords,
  SPREADSHEET_ID,
} = require("./realdata-store");
const {
  SHEET_NAMES,
  TRAVEL_WINDOWS_HEADERS,
  SUGGESTIONS_HEADERS,
  ADMIN_USERS_HEADERS,
  RSVPS_HEADERS,
} = require("../scripts/sheet-schema.js");

function parseJsonSafe(value, fallback) {
  if (value == null || String(value).trim() === "") return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function get(row, i) {
  return row[i] != null ? String(row[i]).trim() : "";
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
      const ordered = headers.map((h) => (row[colIndex[h]] !== undefined ? row[colIndex[h]] : ""));
      return rowToEntity(ordered);
    })
    .filter((e) => e && (e.id != null && e.id !== ""));
}

function rowToTravelWindow(row) {
  const idx = (name) => TRAVEL_WINDOWS_HEADERS.indexOf(name);
  const lat = parseFloat(row[idx("lat")]);
  const lng = parseFloat(row[idx("lng")]);
  return {
    id: get(row, idx("id")),
    personId: get(row, idx("personId")),
    title: get(row, idx("title")),
    city: get(row, idx("city")),
    country: get(row, idx("country")),
    coordinates: {
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
    },
    startDate: get(row, idx("startDate")),
    endDate: get(row, idx("endDate")),
    type: get(row, idx("type")) || "Other",
    notes: get(row, idx("notes")),
  };
}

function rowToSuggestion(row) {
  const idx = (name) => SUGGESTIONS_HEADERS.indexOf(name);
  const payload = parseJsonSafe(row[idx("requestedPayload")], {});
  return {
    id: get(row, idx("id")),
    personName: get(row, idx("personName")),
    personEmailOrHandle: get(row, idx("personEmailOrHandle")),
    requestedChangeType: get(row, idx("requestedChangeType")),
    requestedPayload: payload,
    createdAt: get(row, idx("createdAt")),
    status: get(row, idx("status")) || "Pending",
  };
}

function rowToAdminUser(row) {
  const idx = (name) => ADMIN_USERS_HEADERS.indexOf(name);
  return {
    id: get(row, idx("id")),
    displayName: get(row, idx("displayName")),
    email: get(row, idx("email")),
    passwordPlaceholder: get(row, idx("passwordPlaceholder")),
  };
}

function rowToRSVP(row) {
  const idx = (name) => RSVPS_HEADERS.indexOf(name);
  return {
    eventId: get(row, idx("eventId")),
    eventTitle: get(row, idx("eventTitle")),
    personId: get(row, idx("personId")),
    fullName: get(row, idx("fullName")),
    status: get(row, idx("status")) || "going",
    createdAt: get(row, idx("createdAt")),
    updatedAt: get(row, idx("updatedAt")),
  };
}

function rowsToRSVPs(rows) {
  if (!rows || rows.length < 2) return [];
  const [headerRow, ...dataRows] = rows;
  const colIndex = {};
  RSVPS_HEADERS.forEach((h, i) => {
    colIndex[h] = headerRow[i] === h ? i : headerRow.findIndex((c) => String(c).trim() === h);
  });
  return dataRows
    .map((row) => {
      const ordered = RSVPS_HEADERS.map((h) => (row[colIndex[h]] !== undefined ? row[colIndex[h]] : ""));
      return rowToRSVP(ordered);
    })
    .filter((e) => e && e.eventId && e.personId);
}

async function fetchSheetRange(sheets, sheetName, range) {
  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!${range}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    return data.values || [];
  } catch (err) {
    if (err.code === 400 && err.message?.includes("Unable to parse range")) {
      return [];
    }
    throw err;
  }
}

/**
 * Load the full database from the Google Sheet (Real Data + other tabs).
 * Returns { people, travelWindows, suggestions, adminUsers, rsvps } in the same
 * shape as database.json. Requires GOOGLE_SHEETS_API_KEY or service account.
 */
async function getFullDatabaseFromSheet() {
  const sheets = await getSheetsClient({ write: false });
  if (!sheets) {
    throw new Error("Google Sheets credentials not configured. Set GOOGLE_SHEETS_API_KEY or GOOGLE_SERVICE_ACCOUNT_KEY.");
  }

  const [loaded, twRows, suggestionsRows, adminRows, rsvpsRows] = await Promise.all([
    loadRealDataRecords({ sheets, write: false }),
    fetchSheetRange(sheets, SHEET_NAMES.TRAVEL_WINDOWS, "A:K"),
    fetchSheetRange(sheets, SHEET_NAMES.SUGGESTIONS, "A:G"),
    fetchSheetRange(sheets, SHEET_NAMES.ADMIN_USERS, "A:D"),
    fetchSheetRange(sheets, SHEET_NAMES.RSVPS, "A:G"),
  ]);
  const people = (loaded.records || []).map((r) => r.person).filter((p) => p && p.fullName);
  const travelWindows = rowsToObjects(twRows, TRAVEL_WINDOWS_HEADERS, (row) => rowToTravelWindow(row));
  const suggestions = rowsToObjects(suggestionsRows, SUGGESTIONS_HEADERS, (row) => rowToSuggestion(row));
  const adminUsers = rowsToObjects(adminRows, ADMIN_USERS_HEADERS, (row) => rowToAdminUser(row));
  const rsvps = rowsToRSVPs(rsvpsRows);

  return {
    people,
    travelWindows,
    suggestions,
    adminUsers,
    rsvps,
  };
}

module.exports = {
  getFullDatabaseFromSheet,
};
