#!/usr/bin/env node
/**
 * Cleanup script: remove Berlin "co-working day" rows that land on Wednesdays.
 *
 * Context
 * - Historically we seeded "Berlin coworking Wednesdays" into the Sheet via
 *   `scripts/seed-berlin-coworking.js` (recurrenceGroupId: berlin-coworking-wednesdays).
 * - Product decision: coworking should always be on Thursdays.
 * - The UI already injects Thursday coworking seed events in `src/data/events.ts`,
 *   so removing Wednesday sheet rows is safe and prevents duplicates/old entries.
 *
 * What it does
 * - Reads the Events tab.
 * - Identifies Berlin coworking rows that are on a Wednesday (by startAt date)
 *   and deletes those rows from the sheet.
 *
 * Usage
 *   node scripts/cleanup-berlin-coworking-wednesdays.js           # dry-run (default)
 *   node scripts/cleanup-berlin-coworking-wednesdays.js --apply   # delete rows
 *
 * Requires write access:
 *   GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS
 * Optional:
 *   SPREADSHEET_ID (defaults to the Foresight sheet)
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs").promises;
const path = require("path");
const { google } = require("googleapis");
const { SHEET_NAMES, EVENTS_HEADERS } = require("./sheet-schema.js");

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ";

function parseArgs(argv) {
  const set = new Set(argv.slice(2));
  return {
    apply: set.has("--apply"),
    dryRun: !set.has("--apply"),
  };
}

function parseServiceAccount() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (keyJson) {
    try {
      return typeof keyJson === "string" ? JSON.parse(keyJson) : keyJson;
    } catch (err) {
      throw new Error(`GOOGLE_SERVICE_ACCOUNT_KEY is invalid JSON: ${err.message}`);
    }
  }

  if (keyPath) {
    const resolved = path.resolve(keyPath);
    return fs.readFile(resolved, "utf8").then((txt) => JSON.parse(txt));
  }

  return null;
}

function weekdayUtc(isoDateTime) {
  // We only need weekday for ISO `YYYY-MM-DD...`; the seeded Berlin coworking rows
  // encode local offset (+01/+02). Using the date portion is stable for weekday.
  const datePart = String(isoDateTime || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const [y, m, d] = datePart.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCDay(); // 0=Sun ... 3=Wed
}

async function getEventsSheetId(sheets) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets(properties(sheetId,title))",
  });
  const list = res.data.sheets || [];
  const match = list.find((s) => s?.properties?.title === SHEET_NAMES.EVENTS);
  if (!match?.properties?.sheetId && match?.properties?.sheetId !== 0) {
    throw new Error(`Could not find sheetId for tab "${SHEET_NAMES.EVENTS}".`);
  }
  return match.properties.sheetId;
}

async function fetchEventsRows(sheets) {
  const range = `'${SHEET_NAMES.EVENTS}'!A:O`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return res.data.values || [];
}

function buildColumnIndex(headerRow) {
  const colIndex = {};
  for (const h of EVENTS_HEADERS) {
    colIndex[h] = headerRow.findIndex((c) => String(c).trim() === h);
  }
  return colIndex;
}

function cell(row, colIndex, name) {
  const i = colIndex[name];
  if (i == null || i < 0) return "";
  return row[i] != null ? String(row[i]).trim() : "";
}

function isBerlinCoworkingWednesday(row, colIndex) {
  const id = cell(row, colIndex, "id");
  const nodeSlug = cell(row, colIndex, "nodeSlug");
  const type = cell(row, colIndex, "type").toLowerCase();
  const title = cell(row, colIndex, "title").toLowerCase();
  const startAt = cell(row, colIndex, "startAt");
  const recurrenceGroupId = cell(row, colIndex, "recurrenceGroupId");

  if (nodeSlug !== "berlin") return false;

  const looksLikeCoworking =
    type === "coworking" || title.includes("cowork") || title.includes("co-work");
  const looksLikeSeededWednesday =
    recurrenceGroupId === "berlin-coworking-wednesdays" ||
    id.startsWith("berlin-coworking-");

  if (!looksLikeCoworking || !looksLikeSeededWednesday) return false;

  const day = weekdayUtc(startAt);
  return day === 3; // Wednesday
}

async function deleteRows(sheets, sheetId, rowIndicesZeroBased) {
  if (rowIndicesZeroBased.length === 0) return;

  // Delete from bottom to top so row indices remain stable.
  const sorted = [...rowIndicesZeroBased].sort((a, b) => b - a);

  const CHUNK = 200; // conservative; batchUpdate limit is high but keep payload small
  for (let i = 0; i < sorted.length; i += CHUNK) {
    const slice = sorted.slice(i, i + CHUNK);
    const requests = slice.map((rowIndex) => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: rowIndex,
          endIndex: rowIndex + 1,
        },
      },
    }));
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
  }
}

async function main() {
  const { apply, dryRun } = parseArgs(process.argv);

  const key = await parseServiceAccount();
  if (!key) {
    console.log("Missing Google Sheets write credentials.");
    console.log("Set GOOGLE_SERVICE_ACCOUNT_KEY (JSON) or GOOGLE_APPLICATION_CREDENTIALS (path).");
    console.log("Then re-run:");
    console.log("  node scripts/cleanup-berlin-coworking-wednesdays.js --apply");
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const rows = await fetchEventsRows(sheets);
  if (rows.length < 2) {
    console.log("Events tab is empty (or missing headers). Nothing to do.");
    return;
  }

  const [headerRow, ...dataRows] = rows;
  const colIndex = buildColumnIndex(headerRow);

  const matches = [];
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row) continue;
    if (!isBerlinCoworkingWednesday(row, colIndex)) continue;

    const sheetRowNumber = i + 2; // 1-based row number in Google Sheets UI (row 1 = headers)
    matches.push({
      sheetRowNumber,
      id: cell(row, colIndex, "id"),
      title: cell(row, colIndex, "title"),
      startAt: cell(row, colIndex, "startAt"),
      recurrenceGroupId: cell(row, colIndex, "recurrenceGroupId"),
    });
  }

  if (matches.length === 0) {
    console.log("No Berlin coworking Wednesday rows found. ✅");
    return;
  }

  console.log(`Found ${matches.length} Berlin coworking Wednesday rows:`);
  for (const m of matches.slice(0, 50)) {
    console.log(`- row ${m.sheetRowNumber}: ${m.id} — ${m.startAt} — ${m.title}`);
  }
  if (matches.length > 50) console.log(`…and ${matches.length - 50} more`);

  if (dryRun) {
    console.log("\nDry-run only. Re-run with --apply to delete these rows.");
    return;
  }

  const sheetId = await getEventsSheetId(sheets);
  const rowIndicesZeroBased = matches.map((m) => m.sheetRowNumber - 1); // convert to 0-based index
  await deleteRows(sheets, sheetId, rowIndicesZeroBased);

  console.log(`\nDeleted ${matches.length} rows from "${SHEET_NAMES.EVENTS}".`);
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

