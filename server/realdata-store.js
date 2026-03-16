"use strict";

const { google } = require("googleapis");
const {
  SHEET_NAMES,
  REAL_DATA_TAB_NAMES,
  PEOPLE_HEADERS,
  PEOPLE_SHEET_WIDTH,
} = require("../scripts/sheet-schema.js");

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ";

function parseJsonSafe(value, fallback) {
  if (value == null || String(value).trim() === "") return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

/** Parse focusTags: JSON array, or comma-separated string. */
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
  let n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) return 0;
  if (n < 1900 || n > 2100) return 0;
  return n;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Use only the first line of a string as the display value.
 * Prevents internal notes or disclaimers pasted in the sheet name cell from
 * appearing in the app (e.g. "Name\nPlease note that..." → "Name").
 */
function displayNameOnly(value) {
  const s = normalizeString(value);
  const first = s.split(/\r?\n/)[0];
  return first != null ? first.trim() : s;
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

/** Reject bios that are clearly wrong: boolean strings, scraped menu text, or breadcrumb-only. */
function sanitizeBio(value) {
  const s = normalizeString(value);
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower === "true" || lower === "false") return "";
  if (/^People\s*\/\s*\S+$/.test(s)) return "";
  if (/^Menu\s|^Focus Areas\s|Secure AI Neurotechnology Longevity/.test(s)) return "";
  return s;
}

/** Only accept values that look like image URLs (foresight.org or common image extensions). */
function sanitizeProfileImageUrl(value) {
  const s = normalizeString(value);
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  if (/@/.test(s)) return null; // email, not URL
  if (/foresight\.org/i.test(s) || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(s)) return s;
  return null;
}

/** Reject contact field when it looks like bio/prose (wrong column or pasted description). */
function sanitizeContact(value) {
  const s = normalizeString(value);
  if (!s) return null;
  if (s.length > 180) return null; // contact should be short
  if (/\b(the|and|with|from|have|research|institute|university)\b/i.test(s) && s.length > 80) return null; // prose
  if (/^People\s*\/\s*\S+$/i.test(s)) return null;
  if (/^https?:\/\//i.test(s) && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(s)) return null; // image URL in contact
  return s;
}

function normalizeStringArray(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return Array.from(
    new Set(source.map((entry) => normalizeString(entry)).filter(Boolean)),
  );
}

function normalizeNumber(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function normalizeName(value) {
  return normalizeString(value).toLowerCase().replace(/\s+/g, " ");
}

function slugify(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function scorePersonRichness(person) {
  let score = 0;
  const bump = (condition, amount = 1) => {
    if (condition) score += amount;
  };

  bump(person.fullName, 4);
  bump(person.roleType, 2);
  bump(person.fellowshipCohortYear, 2);
  bump(person.fellowshipEndYear !== null, 1);
  bump(person.affiliationOrInstitution, 1);
  bump(person.focusTags.length > 0, 2);
  bump(person.currentCity, 3);
  bump(person.currentCountry, 2);
  bump(
    Number.isFinite(person.currentCoordinates.lat) &&
      Number.isFinite(person.currentCoordinates.lng) &&
      (person.currentCoordinates.lat !== 0 || person.currentCoordinates.lng !== 0),
    4,
  );
  bump(person.profileUrl, 1);
  bump(person.contactUrlOrHandle, 1);
  bump(person.shortProjectTagline, 1);
  bump(person.expandedProjectDescription, 1);
  return score;
}

function buildStablePersonId(person, rowNumber) {
  const namePart = slugify(person.fullName) || `row-${rowNumber}`;
  const yearPart =
    person.fellowshipCohortYear && person.fellowshipCohortYear > 0
      ? String(person.fellowshipCohortYear)
      : "unknown";
  const rolePart = slugify(person.roleType || "person") || "person";
  return `realdata-${namePart}-${rolePart}-${yearPart}`;
}

function toColumnIndexMap(headerRow) {
  const map = {};
  PEOPLE_HEADERS.forEach((header, idx) => {
    map[header] =
      headerRow[idx] === header
        ? idx
        : headerRow.findIndex((cell) => String(cell).trim() === header);
  });
  return map;
}

function getCell(row, index) {
  return index >= 0 && row[index] != null ? row[index] : "";
}

function rowToPersonRecord(orderedRow, rowNumber) {
  const idx = (name) => PEOPLE_HEADERS.indexOf(name);

  const focusTags = parseFocusTags(orderedRow[idx("focusTags")]);
  const lat = Number.parseFloat(orderedRow[idx("lat")]);
  const lng = Number.parseFloat(orderedRow[idx("lng")]);
  const endYearRaw = orderedRow[idx("fellowshipEndYear")];
  const fellowshipEndYear =
    endYearRaw === "" || endYearRaw == null
      ? null
      : Number.parseInt(String(endYearRaw), 10);

  const person = {
    id: normalizeString(orderedRow[idx("id")]),
    fullName: displayNameOnly(orderedRow[idx("fullName")]),
    roleType: normalizeString(orderedRow[idx("roleType")]) || "Fellow",
    fellowshipCohortYear: sanitizeCohortYear(orderedRow[idx("fellowshipCohortYear")]),
    fellowshipEndYear: Number.isNaN(fellowshipEndYear) ? null : fellowshipEndYear,
    affiliationOrInstitution: normalizeNullableString(
      orderedRow[idx("affiliationOrInstitution")],
    ),
    focusTags: (Array.isArray(focusTags) ? focusTags : []).map(String),
    currentCity: normalizeString(orderedRow[idx("currentCity")]),
    currentCountry: normalizeString(orderedRow[idx("currentCountry")]),
    currentCoordinates: {
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
    },
    primaryNode: normalizeString(orderedRow[idx("primaryNode")]) || "Global",
    profileUrl: normalizeString(orderedRow[idx("profileUrl")]),
    profileImageUrl: sanitizeProfileImageUrl(orderedRow[idx("profileImageUrl")]),
    contactUrlOrHandle: sanitizeContact(orderedRow[idx("contactUrlOrHandle")]),
    shortProjectTagline: normalizeString(orderedRow[idx("shortProjectTagline")]),
    expandedProjectDescription: sanitizeBio(
      orderedRow[idx("expandedProjectDescription")],
    ),
    isAlumni: normalizeBoolean(orderedRow[idx("isAlumni")]),
  };

  if (!person.id && person.fullName) {
    person.id = buildStablePersonId(person, rowNumber);
  }

  return {
    rowNumber,
    person,
    auth: {
      passwordHash: normalizeString(orderedRow[idx("passwordHash")]),
      mustChangePassword: normalizeBoolean(orderedRow[idx("mustChangePassword")]),
      claimedAt: normalizeString(orderedRow[idx("claimedAt")]),
      lastProfileUpdatedAt: normalizeString(orderedRow[idx("lastProfileUpdatedAt")]),
      lastPasswordChangedAt: normalizeString(orderedRow[idx("lastPasswordChangedAt")]),
    },
  };
}

function personRecordToRow(record) {
  const person = record.person || {};
  const auth = record.auth || {};
  return [
    person.id ?? "",
    person.fullName ?? "",
    person.roleType ?? "Fellow",
    person.fellowshipCohortYear ?? "",
    person.fellowshipEndYear ?? "",
    person.affiliationOrInstitution ?? "",
    JSON.stringify(person.focusTags ?? []),
    person.currentCity ?? "",
    person.currentCountry ?? "",
    person.currentCoordinates?.lat ?? "",
    person.currentCoordinates?.lng ?? "",
    person.primaryNode ?? "Global",
    person.profileUrl ?? "",
    person.profileImageUrl ?? "",
    person.contactUrlOrHandle ?? "",
    person.shortProjectTagline ?? "",
    person.expandedProjectDescription ?? "",
    person.isAlumni ? "TRUE" : "FALSE",
    auth.passwordHash ?? "",
    auth.mustChangePassword ? "TRUE" : "FALSE",
    auth.claimedAt ?? "",
    auth.lastProfileUpdatedAt ?? "",
    auth.lastPasswordChangedAt ?? "",
  ];
}

async function getSheetsClient({ write = false } = {}) {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (keyJson || keyPath) {
    let key = null;
    if (keyJson) {
      key = JSON.parse(keyJson);
    } else {
      const fs = require("fs");
      const path = require("path");
      key = JSON.parse(fs.readFileSync(path.resolve(keyPath), "utf8"));
    }

    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    return google.sheets({ version: "v4", auth });
  }

  if (write) return null;

  const apiKey = process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  const auth = new google.auth.GoogleAuth({ apiKey });
  return google.sheets({ version: "v4", auth });
}

async function fetchSheetRows(sheets, sheetName) {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A:${PEOPLE_SHEET_WIDTH}`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return data.values || [];
}

function hasRequiredHeaders(headerRow) {
  return PEOPLE_HEADERS.every((header) =>
    headerRow.some((cell) => String(cell).trim() === header),
  );
}

async function ensureRealDataHeaders(sheets, sheetName, headerRow) {
  if (hasRequiredHeaders(headerRow)) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A1:${PEOPLE_SHEET_WIDTH}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [PEOPLE_HEADERS] },
  });
}

async function loadRealDataRecords(options = {}) {
  const sheets = options.sheets || (await getSheetsClient(options));
  if (!sheets) {
    throw new Error(
      options.write
        ? "Google Sheets write credentials are not configured."
        : "Google Sheets credentials are not configured.",
    );
  }

  for (const tabName of REAL_DATA_TAB_NAMES) {
    try {
      const rows = await fetchSheetRows(sheets, tabName);
      if (!rows || rows.length === 0) continue;

      let [headerRow = [], ...dataRows] = rows;
      if (options.write) {
        await ensureRealDataHeaders(sheets, tabName, headerRow);
        if (!hasRequiredHeaders(headerRow)) {
          const refreshedRows = await fetchSheetRows(sheets, tabName);
          [headerRow = [], ...dataRows] = refreshedRows;
        }
      }
      const indexMap = toColumnIndexMap(headerRow);
      const records = dataRows
        .map((row, index) => {
          const orderedRow = PEOPLE_HEADERS.map((header) =>
            getCell(row, indexMap[header]),
          );
          const record = rowToPersonRecord(orderedRow, index + 2);
          return record.person.fullName ? record : null;
        })
        .filter(Boolean);

      return {
        sheets,
        sheetName: tabName,
        headerRow,
        records,
      };
    } catch (error) {
      if (error?.code === 400 && error?.message?.includes("Unable to parse range")) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("RealData tab is missing or empty.");
}

function chooseCanonicalRecord(records) {
  if (records.length === 0) return null;
  return [...records].sort((left, right) => {
    const byScore = scorePersonRichness(right.person) - scorePersonRichness(left.person);
    if (byScore !== 0) return byScore;
    const leftHasPassword = left.auth.passwordHash ? 1 : 0;
    const rightHasPassword = right.auth.passwordHash ? 1 : 0;
    if (rightHasPassword !== leftHasPassword) {
      return rightHasPassword - leftHasPassword;
    }
    return left.rowNumber - right.rowNumber;
  })[0];
}

function findRecordsByNormalizedName(records, fullName) {
  const normalized = normalizeName(fullName);
  if (!normalized) return [];
  return records.filter(
    (record) => normalizeName(record.person.fullName) === normalized,
  );
}

function cloneRecord(record) {
  return {
    rowNumber: record.rowNumber,
    person: {
      ...record.person,
      focusTags: [...(record.person.focusTags || [])],
      currentCoordinates: {
        lat: record.person.currentCoordinates?.lat ?? 0,
        lng: record.person.currentCoordinates?.lng ?? 0,
      },
    },
    auth: { ...record.auth },
  };
}

async function upsertRealDataRecord(sheets, sheetName, record) {
  const rows = await fetchSheetRows(sheets, sheetName);
  if (rows.length === 0) {
    throw new Error("RealData sheet is missing headers.");
  }

  const [headerRow = [], ...dataRows] = rows;
  if (
    Number.isInteger(record.rowNumber) &&
    record.rowNumber >= 2 &&
    record.rowNumber <= dataRows.length + 1
  ) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A${record.rowNumber}:${PEOPLE_SHEET_WIDTH}${record.rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [personRecordToRow(record)] },
    });
    return record;
  }

  const idColumnIndex = headerRow.findIndex((value) => String(value).trim() === "id");
  const rowIndex =
    idColumnIndex >= 0
      ? dataRows.findIndex(
          (row) => String(row[idColumnIndex] ?? "").trim() === record.person.id,
        )
      : -1;

  const values = [personRecordToRow(record)];
  if (rowIndex >= 0) {
    const rowNumber = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A${rowNumber}:${PEOPLE_SHEET_WIDTH}${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    return { ...record, rowNumber };
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A:${PEOPLE_SHEET_WIDTH}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });

  return record;
}

module.exports = {
  SPREADSHEET_ID,
  normalizeString,
  normalizeStringArray,
  normalizeNumber,
  normalizeBoolean,
  normalizeName,
  scorePersonRichness,
  buildStablePersonId,
  rowToPersonRecord,
  personRecordToRow,
  getSheetsClient,
  loadRealDataRecords,
  findRecordsByNormalizedName,
  chooseCanonicalRecord,
  upsertRealDataRecord,
  cloneRecord,
};
