"use strict";

/**
 * Append-only LoginEvents sheet tab.
 *
 * Records successful directory password logins and profile claims so /stats
 * can show usage windows. Historical visits before this tab existed cannot
 * be recovered — only events written from here forward.
 */

const path = require("path");
const fs = require("fs");
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credPath && !fs.existsSync(path.resolve(credPath))) {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const { google } = require("googleapis");
const {
  getSpreadsheetId,
  SHEET_NAMES,
  LOGIN_EVENTS_HEADERS,
} = require("../scripts/sheet-schema.js");
const {
  isLocalMockMode,
  listLocalLoginEvents,
  appendLocalLoginEvent,
} = require("./local-storage");

const KINDS = new Set(["login", "claim"]);

function sheetsId() {
  return getSpreadsheetId();
}

async function getSheetsClient({ write = false } = {}) {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyJson || keyPath) {
    let key = null;
    if (keyJson) {
      try {
        key = typeof keyJson === "object" ? keyJson : JSON.parse(keyJson);
      } catch {
        key = null;
      }
    }
    if (!key && keyPath) {
      key = JSON.parse(fs.readFileSync(path.resolve(keyPath), "utf8"));
    }
    if (!key) throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_KEY");
    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: write
        ? ["https://www.googleapis.com/auth/spreadsheets"]
        : ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    return google.sheets({ version: "v4", auth });
  }

  const apiKey =
    process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (!apiKey) {
    throw new Error("Missing Google Sheets credentials for login events.");
  }
  if (write) {
    throw new Error(
      "Writing login events requires GOOGLE_SERVICE_ACCOUNT_KEY (API key is read-only).",
    );
  }
  return google.sheets({ version: "v4", auth: apiKey });
}

function isMissingSheetError(err) {
  return (
    err?.code === 400 &&
    typeof err?.message === "string" &&
    err.message.includes("Unable to parse range")
  );
}

function colIndex(headerRow, name) {
  return headerRow.findIndex(
    (c) => String(c).trim().toLowerCase() === name.toLowerCase(),
  );
}

function cell(row, headerRow, name) {
  const i = colIndex(headerRow, name);
  if (i < 0) return "";
  return row[i] != null ? String(row[i]).trim() : "";
}

async function ensureLoginEventsSheet(sheets) {
  const spreadsheetId = sheetsId();
  const title = SHEET_NAMES.LOGIN_EVENTS;
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const exists = (data.sheets || []).some(
    (s) => String(s?.properties?.title || "") === title,
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1:D1`,
    valueInputOption: "RAW",
    requestBody: { values: [LOGIN_EVENTS_HEADERS] },
  });
}

function parseLoginRows(values) {
  if (!values || values.length < 2) return [];
  const [headerRow, ...rows] = values;
  return rows
    .map((row) => {
      const personId = cell(row, headerRow, "personId");
      const at = cell(row, headerRow, "at");
      if (!personId || !at) return null;
      const kindRaw = cell(row, headerRow, "kind").toLowerCase() || "login";
      const kind = KINDS.has(kindRaw) ? kindRaw : "login";
      return {
        personId,
        fullName: cell(row, headerRow, "fullName"),
        kind,
        at,
      };
    })
    .filter(Boolean);
}

async function loadLoginEventRows({ write = false } = {}) {
  if (isLocalMockMode()) {
    return { sheets: null, rows: await listLocalLoginEvents() };
  }

  const sheets = await getSheetsClient({ write });
  const spreadsheetId = sheetsId();
  const title = SHEET_NAMES.LOGIN_EVENTS;
  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${title}'!A:D`,
    });
    return { sheets, rows: parseLoginRows(data.values || []) };
  } catch (err) {
    if (!isMissingSheetError(err)) throw err;
    if (!write) return { sheets, rows: [] };
    await ensureLoginEventsSheet(sheets);
    return { sheets, rows: [] };
  }
}

/**
 * Fire-and-forget friendly: never throws to callers that await it for stats,
 * but login paths should `.catch` so auth never fails on a sheet write.
 *
 * @param {{ personId: string, fullName?: string, kind?: "login"|"claim" }} input
 */
async function recordLoginEvent(input) {
  const personId = String(input?.personId || "").trim();
  if (!personId) return null;
  const kindRaw = String(input?.kind || "login").trim().toLowerCase();
  const kind = KINDS.has(kindRaw) ? kindRaw : "login";
  const row = {
    personId,
    fullName: String(input?.fullName || "").trim(),
    kind,
    at: new Date().toISOString(),
  };

  if (isLocalMockMode()) {
    return appendLocalLoginEvent(row);
  }

  const { sheets } = await loadLoginEventRows({ write: true });
  await ensureLoginEventsSheet(sheets);
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetsId(),
    range: `'${SHEET_NAMES.LOGIN_EVENTS}'!A:D`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[row.personId, row.fullName, row.kind, row.at]],
    },
  });
  return row;
}

function startOfUtcDay(d = new Date()) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function countInWindow(rows, sinceMs) {
  return rows.filter((r) => {
    const t = new Date(r.at).getTime();
    return Number.isFinite(t) && t >= sinceMs;
  }).length;
}

function uniquePeopleInWindow(rows, sinceMs) {
  const ids = new Set();
  for (const r of rows) {
    const t = new Date(r.at).getTime();
    if (!Number.isFinite(t) || t < sinceMs) continue;
    ids.add(r.personId);
  }
  return ids.size;
}

/**
 * Aggregate login/claim events into usage windows.
 * @param {Array<{ at: string, kind: string, personId: string }>} rows
 */
function buildLoginStats(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const now = Date.now();
  const todayStart = startOfUtcDay(new Date());
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
  const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000;

  const logins = list.filter((r) => r.kind === "login");
  const claims = list.filter((r) => r.kind === "claim");

  return {
    trackingStartedAt: list.length
      ? list.reduce(
          (min, r) => (r.at < min ? r.at : min),
          list[0].at,
        )
      : null,
    totalEvents: list.length,
    logins: {
      today: countInWindow(logins, todayStart),
      last7Days: countInWindow(logins, weekStart),
      last30Days: countInWindow(logins, monthStart),
      allTime: logins.length,
      uniquePeopleAllTime: new Set(logins.map((r) => r.personId)).size,
      uniquePeopleLast30Days: uniquePeopleInWindow(logins, monthStart),
    },
    claims: {
      today: countInWindow(claims, todayStart),
      last7Days: countInWindow(claims, weekStart),
      last30Days: countInWindow(claims, monthStart),
      allTime: claims.length,
    },
    /** Wall-clock of this aggregation — not "last visit". */
    generatedAt: new Date(now).toISOString(),
  };
}

async function loadLoginStats() {
  try {
    const { rows } = await loadLoginEventRows({ write: false });
    return buildLoginStats(rows);
  } catch (err) {
    console.warn("[login-events] load skipped:", err?.message || err);
    return buildLoginStats([]);
  }
}

module.exports = {
  recordLoginEvent,
  loadLoginStats,
  buildLoginStats,
  LOGIN_EVENTS_HEADERS,
};
