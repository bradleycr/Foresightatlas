/**
 * Shared schema for the Foresight Map Google Sheet.
 * Default sheet ID (override with env SPREADSHEET_ID):
 *
 * Tabs: RealData, TravelWindows, Suggestions, AdminUsers, RSVPs, Events,
 *       SignalCheckins, DailyTable-Berlin, DailyTable-SF.
 * The optional CheckIns tab (used by api/checkins.js for node check-in) is separate from SignalCheckins/DailyTable; not listed here.
 * Row 1 = headers; data from row 2. Arrays/objects stored as JSON strings.
 *
 * RealData is the canonical source of truth for people records. The legacy
 * People tab is still named here only so older read-only scripts can inspect
 * or compare it during migration cleanup.
 */

const DEFAULT_SPREADSHEET_ID = "1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ";

function getSpreadsheetId() {
  return process.env.SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
}

const SHEET_NAMES = {
  PEOPLE: "People",
  /** Canonical name; sync also tries REAL_DATA_TAB_NAMES for compatibility. */
  REAL_DATA: "RealData",
  TRAVEL_WINDOWS: "TravelWindows",
  SUGGESTIONS: "Suggestions",
  ADMIN_USERS: "AdminUsers",
  RSVPS: "RSVPs",
  EVENTS: "Events",
  SIGNAL_CHECKINS: "SignalCheckins",
  DAILY_TABLE_BERLIN: "DailyTable-Berlin",
  DAILY_TABLE_SF: "DailyTable-SF",
};

/** Try these in order when resolving the Real Data tab (sheet may use "Real Data" or "RealData"). */
const REAL_DATA_TAB_NAMES = ["RealData", "Real Data"];

const PEOPLE_PUBLIC_HEADERS = [
  "id",
  "fullName",
  "roleType",
  "fellowshipCohortYear",
  "fellowshipEndYear",
  "affiliationOrInstitution",
  "focusTags",
  "currentCity",
  "currentCountry",
  "lat",
  "lng",
  "primaryNode",
  "profileUrl",
  "profileImageUrl",
  "contactUrlOrHandle",
  "shortProjectTagline",
  "expandedProjectDescription",
  "isAlumni",
];

const PEOPLE_AUTH_HEADERS = [
  "passwordHash",
  "mustChangePassword",
  "claimedAt",
  "lastProfileUpdatedAt",
  "lastPasswordChangedAt",
];

const PEOPLE_HEADERS = [...PEOPLE_PUBLIC_HEADERS, ...PEOPLE_AUTH_HEADERS];

const TRAVEL_WINDOWS_HEADERS = [
  "id",
  "personId",
  "title",
  "city",
  "country",
  "lat",
  "lng",
  "startDate",
  "endDate",
  "type",
  "notes",
];

const SUGGESTIONS_HEADERS = [
  "id",
  "personName",
  "personEmailOrHandle",
  "requestedChangeType",
  "requestedPayload",
  "createdAt",
  "status",
];

const ADMIN_USERS_HEADERS = ["id", "displayName", "email", "passwordPlaceholder"];

const RSVPS_HEADERS = [
  "eventId",
  "eventTitle",
  "personId",
  "fullName",
  "status",
  "createdAt",
  "updatedAt",
];

const EVENTS_HEADERS = [
  "id",
  "nodeSlug",
  "title",
  "description",
  "location",
  "startAt",
  "endAt",
  "type",
  "tags",
  "visibility",
  "capacity",
  "externalLink",
  "recurrenceGroupId",
  "lumaEventId",
  "coverImageUrl",
];

/** Append-only log of every /checkin command received via Signal. */
const SIGNAL_CHECKINS_HEADERS = [
  "Timestamp",
  "UserPhone",
  "UserName",
  "Action",
  "RawMessage",
  "ParsedDates",
  "NodeSlug",
  "GroupId",
];

/** Per-node attendance grid — one row per phone/date, upserted on each check-in. */
const DAILY_TABLE_HEADERS = [
  "Date",
  "UserPhone",
  "UserName",
  "Status",
  "Notes",
  "UpdatedAt",
];

/** Resolve a DailyTable tab name from a node slug ("berlin" → "DailyTable-Berlin"). */
function dailyTableTabName(nodeSlug) {
  const label = { berlin: "Berlin", sf: "SF" }[nodeSlug];
  if (!label) throw new Error(`Unknown node slug for DailyTable: ${nodeSlug}`);
  return `DailyTable-${label}`;
}

/**
 * True when location is TBA, empty, or "to be announced".
 * Events with unspecified location belong on Global programming, not a specific node.
 */
function isLocationUnspecified(location) {
  const s = (location || "").trim().toLowerCase();
  if (!s) return true;
  if (s === "tba" || s === "tbd") return true;
  if (/to be announced/.test(s) || /to be determined/.test(s)) return true;
  return false;
}

function getSheetColumnLetter(index) {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

const PEOPLE_SHEET_WIDTH = getSheetColumnLetter(PEOPLE_HEADERS.length - 1);

module.exports = {
  DEFAULT_SPREADSHEET_ID,
  getSpreadsheetId,
  SHEET_NAMES,
  REAL_DATA_TAB_NAMES,
  PEOPLE_PUBLIC_HEADERS,
  PEOPLE_AUTH_HEADERS,
  PEOPLE_HEADERS,
  PEOPLE_SHEET_WIDTH,
  TRAVEL_WINDOWS_HEADERS,
  SUGGESTIONS_HEADERS,
  ADMIN_USERS_HEADERS,
  RSVPS_HEADERS,
  EVENTS_HEADERS,
  SIGNAL_CHECKINS_HEADERS,
  DAILY_TABLE_HEADERS,
  dailyTableTabName,
  isLocationUnspecified,
  getSheetColumnLetter,
};
