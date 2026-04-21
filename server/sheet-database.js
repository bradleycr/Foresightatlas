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
  EVENTS_HEADERS,
  isLocationUnspecified,
} = require("../scripts/sheet-schema.js");
const {
  applyBerlinSecureWorkshopSheetOverrides,
  normalizeBerlinSecureWorkshopRsvps,
} = require("./event-corrections");

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
  const rawStatus = get(row, idx("status"));
  const status = rawStatus === "interested" || rawStatus === "not-going" ? rawStatus : "going";
  return {
    eventId: get(row, idx("eventId")),
    eventTitle: get(row, idx("eventTitle")),
    personId: get(row, idx("personId")),
    fullName: get(row, idx("fullName")),
    status,
    createdAt: get(row, idx("createdAt")),
    updatedAt: get(row, idx("updatedAt")),
  };
}

/** Sheet is append-only: same person can have multiple rows per event. Keep one per (eventId, personId), latest by updatedAt. */
function rowsToRSVPs(rows) {
  if (!rows || rows.length < 2) return [];
  const [headerRow, ...dataRows] = rows;
  const colIndex = {};
  RSVPS_HEADERS.forEach((h, i) => {
    colIndex[h] = headerRow[i] === h ? i : headerRow.findIndex((c) => String(c).trim() === h);
  });
  const list = dataRows
    .map((row) => {
      const ordered = RSVPS_HEADERS.map((h) => (row[colIndex[h]] !== undefined ? row[colIndex[h]] : ""));
      return rowToRSVP(ordered);
    })
    .filter((e) => e && e.eventId && e.personId);
  const byKey = new Map();
  for (const r of list) {
    const key = `${r.eventId}\t${r.personId}`;
    const existing = byKey.get(key);
    if (!existing || new Date(r.updatedAt) > new Date(existing.updatedAt)) byKey.set(key, r);
  }
  return Array.from(byKey.values());
}

function rowToEvent(row) {
  const idx = (name) => EVENTS_HEADERS.indexOf(name);
  const rawNodeSlug = get(row, idx("nodeSlug"));
  const location = get(row, idx("location")) || "";
  /*
   * Resolve nodeSlug from the sheet row. When a row is linked to a Luma
   * event (via lumaEventId) we want Luma's richer geo data to win if the
   * sheet didn't explicitly assign a node. We therefore leave nodeSlug
   * null here unless the sheet is unambiguous; the merge step in
   * luma-merge.js then fills in from the Luma event, ultimately falling
   * back to "global" if neither side can decide.
   */
  let nodeSlug = null;
  if (isLocationUnspecified(location)) {
    nodeSlug = "global";
  } else if (
    rawNodeSlug === "berlin" ||
    rawNodeSlug === "sf" ||
    rawNodeSlug === "global"
  ) {
    nodeSlug = rawNodeSlug;
  }
  const cap = get(row, idx("capacity"));
  const tags = parseJsonSafe(get(row, idx("tags")), []);
  return {
    id: get(row, idx("id")),
    nodeSlug,
    title: get(row, idx("title")) || "Untitled",
    description: get(row, idx("description")) || "",
    location,
    startAt: get(row, idx("startAt")) || new Date(0).toISOString(),
    endAt: get(row, idx("endAt")) || new Date(0).toISOString(),
    type: get(row, idx("type")) || "other",
    tags: Array.isArray(tags) ? tags : [],
    visibility: get(row, idx("visibility")) === "public" ? "public" : "internal",
    capacity: cap === "" ? null : parseInt(cap, 10) || null,
    externalLink: get(row, idx("externalLink")) || null,
    coverImageUrl: get(row, idx("coverImageUrl")) || null,
    recurrenceGroupId: get(row, idx("recurrenceGroupId")) || null,
    _lumaEventId: get(row, idx("lumaEventId")) || null,
  };
}

function rowsToEvents(rows) {
  if (!rows || rows.length < 2) return [];
  const [headerRow, ...dataRows] = rows;
  const colIndex = {};
  EVENTS_HEADERS.forEach((h, i) => {
    colIndex[h] = headerRow[i] === h ? i : headerRow.findIndex((c) => String(c).trim() === h);
  });
  return dataRows
    .map((row) => {
      const ordered = EVENTS_HEADERS.map((h) => (row[colIndex[h]] !== undefined ? row[colIndex[h]] : ""));
      return rowToEvent(ordered);
    })
    .filter((e) => e && e.id);
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
    const envHint = process.env.VERCEL
      ? " Set GOOGLE_SHEETS_API_KEY or GOOGLE_SERVICE_ACCOUNT_KEY (and SPREADSHEET_ID) in Vercel → Project → Settings → Environment Variables. See docs/VERCEL_ENV.md."
      : " Set GOOGLE_SHEETS_API_KEY (read-only) or GOOGLE_SERVICE_ACCOUNT_KEY in .env.local. Optional: SPREADSHEET_ID. See docs/SHEETS_SYNC.md.";
    throw new Error("Google Sheets credentials not configured. " + envHint);
  }

  const [loaded, twRows, suggestionsRows, adminRows, rsvpsRows, eventsRows] = await Promise.all([
    loadRealDataRecords({ sheets, write: false }),
    fetchSheetRange(sheets, SHEET_NAMES.TRAVEL_WINDOWS, "A:K"),
    fetchSheetRange(sheets, SHEET_NAMES.SUGGESTIONS, "A:G"),
    fetchSheetRange(sheets, SHEET_NAMES.ADMIN_USERS, "A:D"),
    fetchSheetRange(sheets, SHEET_NAMES.RSVPS, "A:G"),
    fetchSheetRange(sheets, SHEET_NAMES.EVENTS, "A:O"),
  ]);
  const people = (loaded.records || []).map((r) => r.person).filter((p) => p && p.fullName);
  const travelWindows = rowsToObjects(twRows, TRAVEL_WINDOWS_HEADERS, (row) => rowToTravelWindow(row));
  const suggestions = rowsToObjects(suggestionsRows, SUGGESTIONS_HEADERS, (row) => rowToSuggestion(row));
  const adminUsers = rowsToObjects(adminRows, ADMIN_USERS_HEADERS, (row) => rowToAdminUser(row));
  let rsvps = rowsToRSVPs(rsvpsRows);
  let events = rowsToEvents(eventsRows);
  events = applyBerlinSecureWorkshopSheetOverrides(events);
  rsvps = normalizeBerlinSecureWorkshopRsvps(rsvps);

  return {
    people,
    travelWindows,
    suggestions,
    adminUsers,
    rsvps,
    events,
  };
}

module.exports = {
  getFullDatabaseFromSheet,
};
