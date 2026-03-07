/**
 * Google Sheets operations for the Signal check-in pipeline.
 *
 * Two tab families:
 *   SignalCheckins      — append-only audit log (one row per command)
 *   DailyTable-{Node}   — attendance grid (one row per phone/date, upserted)
 *
 * Auth follows the same pattern as api/checkins.js:
 *   Read  → API key  (GOOGLE_SHEETS_API_KEY / GOOGLE_API_KEY)
 *   Write → service account  (GOOGLE_SERVICE_ACCOUNT_KEY / GOOGLE_APPLICATION_CREDENTIALS)
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const {
  SHEET_NAMES,
  SIGNAL_CHECKINS_HEADERS,
  DAILY_TABLE_HEADERS,
  dailyTableTabName,
  getSheetColumnLetter,
} = require("../../scripts/sheet-schema");

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ";

/* ── Auth helpers (mirror api/checkins.js) ──────────────────────────────── */

async function getSheetsClientForRead() {
  const key = process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return null;
  const auth = new google.auth.GoogleAuth({ apiKey: key });
  return google.sheets({ version: "v4", auth });
}

async function getSheetsClientForWrite() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let key = null;
  if (keyJson) {
    try { key = JSON.parse(keyJson); } catch { return null; }
  } else if (keyPath) {
    try {
      key = JSON.parse(fs.readFileSync(path.resolve(keyPath), "utf8"));
    } catch (e) {
      console.error("[sheets-ops] GOOGLE_APPLICATION_CREDENTIALS read failed:", e.message);
      return null;
    }
  }
  if (!key) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/* ── SignalCheckins — append ─────────────────────────────────────────────── */

/**
 * Append a single row to the SignalCheckins tab.
 *
 * @param {{
 *   timestamp: string,
 *   userPhone: string,
 *   userName: string,
 *   action: string,
 *   rawMessage: string,
 *   parsedDates: string,
 *   nodeSlug: string,
 *   groupId: string,
 * }} row
 */
async function appendSignalCheckin(row) {
  const sheets = await getSheetsClientForWrite();
  if (!sheets) throw new Error("Sheet write credentials not configured");

  const tab = SHEET_NAMES.SIGNAL_CHECKINS;
  const width = getSheetColumnLetter(SIGNAL_CHECKINS_HEADERS.length - 1);
  const values = [[
    row.timestamp,
    row.userPhone,
    row.userName,
    row.action,
    row.rawMessage,
    row.parsedDates,
    row.nodeSlug,
    row.groupId,
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${tab}'!A:${width}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}

/* ── DailyTable — query + upsert ────────────────────────────────────────── */

/**
 * Read all rows from a DailyTable tab, optionally filtered by phone and dates.
 *
 * @param {string} nodeSlug — "berlin" | "sf"
 * @param {{ phone?: string, dates?: string[] }} [filters]
 * @returns {Promise<Array<{ Date: string, UserPhone: string, UserName: string, Status: string, Notes: string, UpdatedAt: string, _rowIndex: number }>>}
 */
async function queryDailyTable(nodeSlug, filters = {}) {
  const sheets = await getSheetsClientForRead();
  if (!sheets) throw new Error("Sheet read credentials not configured");

  const tab = dailyTableTabName(nodeSlug);
  const width = getSheetColumnLetter(DAILY_TABLE_HEADERS.length - 1);

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${tab}'!A:${width}`,
  });

  const values = data.values || [];
  if (values.length < 2) return [];

  const [headerRow, ...rows] = values;
  const col = (name) => {
    const i = headerRow.findIndex(
      (c) => String(c).trim().toLowerCase() === name.toLowerCase(),
    );
    return i >= 0 ? i : -1;
  };

  return rows
    .map((row, idx) => ({
      Date: (row[col("Date")] || "").trim(),
      UserPhone: (row[col("UserPhone")] || "").trim(),
      UserName: (row[col("UserName")] || "").trim(),
      Status: (row[col("Status")] || "").trim(),
      Notes: (row[col("Notes")] || "").trim(),
      UpdatedAt: (row[col("UpdatedAt")] || "").trim(),
      _rowIndex: idx + 2,  // 1-based, +1 for header
    }))
    .filter((r) => {
      if (filters.phone && r.UserPhone !== filters.phone) return false;
      if (filters.dates && !filters.dates.includes(r.Date)) return false;
      return true;
    });
}

/**
 * Batch upsert rows into a DailyTable tab.
 * For each (Date, UserPhone) pair: update if exists, append if new.
 *
 * @param {string} nodeSlug
 * @param {Array<{ date: string, userPhone: string, userName: string, status: string, notes: string }>} rows
 */
async function upsertDailyTableRows(nodeSlug, rows) {
  if (!rows.length) return;

  const sheets = await getSheetsClientForWrite();
  if (!sheets) throw new Error("Sheet write credentials not configured");

  const tab = dailyTableTabName(nodeSlug);
  const width = getSheetColumnLetter(DAILY_TABLE_HEADERS.length - 1);
  const now = new Date().toISOString();

  /* Load existing data so we can find rows to update vs. append */
  const existing = await queryDailyTable(nodeSlug, {
    phone: rows[0].userPhone,
    dates: rows.map((r) => r.date),
  });

  const existingMap = new Map(
    existing.map((e) => [`${e.Date}::${e.UserPhone}`, e]),
  );

  const toAppend = [];
  const batchUpdates = [];

  for (const row of rows) {
    const key = `${row.date}::${row.userPhone}`;
    const ex = existingMap.get(key);
    const values = [
      row.date,
      row.userPhone,
      row.userName,
      row.status,
      row.notes || "",
      now,
    ];

    if (ex) {
      /* Update existing row in-place */
      batchUpdates.push({
        range: `'${tab}'!A${ex._rowIndex}:${width}${ex._rowIndex}`,
        values: [values],
      });
    } else {
      toAppend.push(values);
    }
  }

  /* Batch update existing rows */
  if (batchUpdates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: batchUpdates,
      },
    });
  }

  /* Append new rows */
  if (toAppend.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${tab}'!A:${width}`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: toAppend },
    });
  }
}

/**
 * Read the full DailyTable for a node — used by the revalidation API route.
 *
 * @param {string} nodeSlug
 * @returns {Promise<Array<{ Date: string, UserPhone: string, UserName: string, Status: string, Notes: string, UpdatedAt: string }>>}
 */
async function readDailyTable(nodeSlug) {
  const rows = await queryDailyTable(nodeSlug);
  return rows.map(({ _rowIndex, ...rest }) => rest);
}

module.exports = {
  appendSignalCheckin,
  queryDailyTable,
  upsertDailyTableRows,
  readDailyTable,
};
