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
  REAL_DATA_TAB_NAMES,
  PEOPLE_HEADERS,
  PEOPLE_SHEET_WIDTH,
  TRAVEL_WINDOWS_HEADERS,
  SUGGESTIONS_HEADERS,
  ADMIN_USERS_HEADERS,
  RSVPS_HEADERS,
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

/** Reject bios that are boolean, menu text, or breadcrumb-only (same as realdata-store). */
function sanitizeBio(value) {
  const s = value != null ? String(value).trim() : "";
  if (!s) return "";
  if (/^true$/i.test(s) || /^false$/i.test(s)) return "";
  if (/^People\s*\/\s*\S+$/.test(s)) return "";
  if (/^Menu\s|^Focus Areas\s|Secure AI Neurotechnology Longevity/.test(s)) return "";
  return s;
}

/** Only accept image URLs; reject emails or non-URLs (same as realdata-store). */
function sanitizeProfileImageUrl(value) {
  const s = value != null ? String(value).trim() : "";
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  if (/@/.test(s)) return null;
  if (/foresight\.org/i.test(s) || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(s)) return s;
  return null;
}

/** Reject contact when it looks like bio/prose (same as realdata-store). */
function sanitizeContact(value) {
  const s = value != null ? String(value).trim() : "";
  if (!s) return null;
  if (s.length > 180) return null;
  if (/\b(the|and|with|from|have|research|institute|university)\b/i.test(s) && s.length > 80) return null;
  if (/^People\s*\/\s*\S+$/i.test(s)) return null;
  if (/^https?:\/\//i.test(s) && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(s)) return null;
  return s;
}

/** Parse focusTags: JSON array, or comma-separated string. So sheet can store either format. */
function parseFocusTags(value) {
  if (value == null || String(value).trim() === "") return [];
  const s = String(value).trim();
  const parsed = parseJsonSafe(s, null);
  if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean);
  return s.split(",").map((t) => t.trim()).filter(Boolean);
}

/** Sanitize cohort year: valid 1900–2100 only; anything else (blank, Excel serial, garbage) → 0 (unknown / all-time). */
function sanitizeCohortYear(value) {
  if (value === "" || value == null) return 0;
  let n = parseInt(String(value), 10);
  if (Number.isNaN(n)) return 0;
  // Treat Excel serials and any invalid number as unknown (e.g. prize winners with 45966)
  if (n < 1900 || n > 2100) return 0;
  return n;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildStableMissingId(person, rowIndex) {
  const namePart = slugify(person.fullName) || `row-${rowIndex}`;
  const rolePart = slugify(person.roleType || "person") || "person";
  const yearPart =
    person.fellowshipCohortYear && person.fellowshipCohortYear > 0
      ? String(person.fellowshipCohortYear)
      : "unknown";
  return `realdata-${namePart}-${rolePart}-${yearPart}`;
}

function rowToPerson(row) {
  const get = (i) => (row[i] != null ? String(row[i]).trim() : "");
  const idx = (name) => PEOPLE_HEADERS.indexOf(name);
  const focusTags = parseFocusTags(row[idx("focusTags")]);
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
    fellowshipCohortYear: sanitizeCohortYear(row[idx("fellowshipCohortYear")]),
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
    profileImageUrl: sanitizeProfileImageUrl(row[idx("profileImageUrl")]),
    contactUrlOrHandle: sanitizeContact(row[idx("contactUrlOrHandle")]),
    shortProjectTagline: get(idx("shortProjectTagline")),
    expandedProjectDescription: sanitizeBio(row[idx("expandedProjectDescription")]),
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

function rowToRSVP(row) {
  const get = (i) => (row[i] != null ? String(row[i]).trim() : "");
  const idx = (name) => RSVPS_HEADERS.indexOf(name);
  const rawStatus = get(idx("status"));
  const status = rawStatus === "interested" || rawStatus === "not-going" ? rawStatus : "going";
  return {
    eventId: get(idx("eventId")),
    eventTitle: get(idx("eventTitle")),
    personId: get(idx("personId")),
    fullName: get(idx("fullName")),
    status,
    createdAt: get(idx("createdAt")),
    updatedAt: get(idx("updatedAt")),
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

/**
 * Parse people rows when id column may be empty (e.g. RealData tab).
 * Missing ids are replaced with a deterministic synthetic id so row order
 * changes do not rewrite identities.
 */
function rowsToPeopleAllowEmptyId(rows) {
  if (!rows || rows.length < 2) return [];
  const [headerRow, ...dataRows] = rows;
  const colIndex = {};
  PEOPLE_HEADERS.forEach((h, i) => {
    colIndex[h] = headerRow[i] === h ? i : headerRow.findIndex((c) => String(c).trim() === h);
  });
  return dataRows
    .map((row, i) => {
      const ordered = PEOPLE_HEADERS.map((h) => row[colIndex[h]]);
      const person = rowToPerson(ordered);
      if (person && (person.fullName != null && person.fullName !== "")) {
        if (!person.id || String(person.id).trim() === "") {
          person.id = buildStableMissingId(person, i + 2);
        }
        return person;
      }
      return null;
    })
    .filter(Boolean);
}

function rowsToRSVPs(rows) {
  if (!rows || rows.length < 2) return [];
  const [headerRow, ...dataRows] = rows;
  const colIndex = {};
  RSVPS_HEADERS.forEach((h, i) => {
    colIndex[h] = headerRow[i] === h ? i : headerRow.findIndex((c) => String(c).trim() === h);
  });
  const list = dataRows
    .map((row) => {
      const ordered = RSVPS_HEADERS.map((h) => row[colIndex[h]]);
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

  const [twRows, suggestionsRows, adminRows, rsvpsRows] = await Promise.all([
    fetchSheetRange(sheets, SHEET_NAMES.TRAVEL_WINDOWS, "A:K"),
    fetchSheetRange(sheets, SHEET_NAMES.SUGGESTIONS, "A:G"),
    fetchSheetRange(sheets, SHEET_NAMES.ADMIN_USERS, "A:D"),
    fetchSheetRange(sheets, SHEET_NAMES.RSVPS, "A:G"),
  ]);

  // Resolve Real Data tab: try each possible name (e.g. "RealData" or "Real Data") so sync works either way
  let realDataRows = [];
  let realDataTabUsed = null;
  for (const tabName of REAL_DATA_TAB_NAMES) {
    const rows = await fetchSheetRange(sheets, tabName, `A:${PEOPLE_SHEET_WIDTH}`);
    if (rows && rows.length >= 2) {
      realDataRows = rows;
      realDataTabUsed = tabName;
      break;
    }
  }

  if (realDataTabUsed) {
    console.log(`Using '${realDataTabUsed}' for people (${realDataRows.length - 1} rows).`);
  } else {
    console.log("RealData tab not found or empty; keeping existing public/data/database.json.");
    return;
  }

  const people = rowsToPeopleAllowEmptyId(realDataRows);
  const travelWindows = rowsToObjects(twRows, TRAVEL_WINDOWS_HEADERS, (row) =>
    rowToTravelWindow(row)
  );
  const suggestions = rowsToObjects(suggestionsRows, SUGGESTIONS_HEADERS, (row) =>
    rowToSuggestion(row)
  );
  const adminUsers = rowsToObjects(adminRows, ADMIN_USERS_HEADERS, (row) =>
    rowToAdminUser(row)
  );
  const rsvps = rowsToRSVPs(rsvpsRows);

  const database = {
    people,
    travelWindows,
    suggestions,
    adminUsers,
    rsvps,
  };

  if (people.length === 0) {
    console.log(
      "RealData has no people; keeping existing public/data/database.json."
    );
    return;
  }

  const outPath = path.join(__dirname, "../public/data/database.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(database, null, 2), "utf8");

  console.log(
    `Wrote ${outPath}: ${people.length} people, ${travelWindows.length} travel windows, ${suggestions.length} suggestions, ${adminUsers.length} admin users, ${rsvps.length} RSVPs.`
  );
}

main().catch((err) => {
  console.error("Sync failed (will use existing database.json):", err.message);
  process.exit(0); // Don't fail build — fall back to committed JSON
});
