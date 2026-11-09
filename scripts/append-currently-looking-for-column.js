#!/usr/bin/env node
/**
 * Append `currentlyLookingFor` as the last RealData header cell.
 *
 * Writes that one cell only. Does not rewrite row 1, does not touch people
 * rows, and does not read or print roster data. Missing cells on existing
 * rows are the backfill — reads treat them as an empty sentence.
 *
 *   node scripts/append-currently-looking-for-column.js
 *   node scripts/append-currently-looking-for-column.js --apply
 */

require("dotenv").config({ path: ".env.local", quiet: true });
require("dotenv").config({ quiet: true });

const {
  PEOPLE_HEADERS,
  REAL_DATA_TAB_NAMES,
  PEOPLE_SHEET_WIDTH,
  getSpreadsheetId,
} = require("./sheet-schema");
const { getSheetsClient } = require("../server/realdata-store");

const APPLY = process.argv.includes("--apply");
const COLUMN = "currentlyLookingFor";

/**
 * Some local .env files store the service-account JSON with a raw newline in
 * the private key, so JSON.parse fails. The credentials file is the fallback
 * getSheetsClient already understands — but only when the env string is unset.
 */
function preferCredentialsFileWhenEnvKeyWillNotParse() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw || !process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
  try {
    JSON.parse(raw);
  } catch {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  }
}

function looksLikeHeader(value) {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(value);
}

/**
 * The grid is only as wide as the columns already used. Appending one column
 * at the end does not move passwordHash or any other cell.
 */
async function appendOneColumnIfNeeded(sheets, spreadsheetId, sheetName) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(columnCount)))",
  });
  const sheet = (meta.data.sheets || []).find(
    (entry) => entry.properties?.title === sheetName,
  );
  if (!sheet?.properties) {
    throw new Error(`Could not find the ${sheetName} tab.`);
  }
  const columnCount = sheet.properties.gridProperties?.columnCount ?? 0;
  const needed = PEOPLE_HEADERS.length;
  if (columnCount >= needed) return;
  const extra = needed - columnCount;
  if (extra !== 1) {
    throw new Error(
      `Refusing to grow ${sheetName} by ${extra} columns. This script appends exactly one.`,
    );
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          appendDimension: {
            sheetId: sheet.properties.sheetId,
            dimension: "COLUMNS",
            length: 1,
          },
        },
      ],
    },
  });
  console.log(`Appended 1 column at the end of ${sheetName}.`);
}

async function readHeader(sheets, spreadsheetId, sheetName) {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!1:1`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return (data.values && data.values[0]) || [];
}

async function main() {
  if (PEOPLE_HEADERS[PEOPLE_HEADERS.length - 1] !== COLUMN) {
    throw new Error(
      `${COLUMN} must be the last PEOPLE_HEADERS entry before this script runs.`,
    );
  }

  preferCredentialsFileWhenEnvKeyWillNotParse();
  const spreadsheetId = getSpreadsheetId();
  const sheets = await getSheetsClient({ write: APPLY });
  if (!sheets) {
    throw new Error(
      "Google Sheets credentials are not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY.",
    );
  }

  const prior = PEOPLE_HEADERS.slice(0, -1);
  let sheetName = null;
  let headerRow = null;

  for (const tabName of REAL_DATA_TAB_NAMES) {
    try {
      const row = await readHeader(sheets, spreadsheetId, tabName);
      if (row.length === 0) continue;
      sheetName = tabName;
      headerRow = row;
      break;
    } catch (error) {
      if (error?.code === 400 && String(error.message || "").includes("Unable to parse range")) {
        continue;
      }
      throw error;
    }
  }

  if (!sheetName || !headerRow) {
    throw new Error("RealData tab is missing or has no header row.");
  }

  const actualPrior = headerRow.slice(0, prior.length).map((cell) => String(cell ?? "").trim());
  for (let i = 0; i < prior.length; i += 1) {
    if (actualPrior[i] === prior[i]) continue;
    const found = actualPrior[i];
    const detail = looksLikeHeader(found) ? `found "${found}"` : "found a non-header cell";
    throw new Error(
      `Refusing to append. Column ${i + 1} should be "${prior[i]}" (${detail}).`,
    );
  }

  const next = String(headerRow[PEOPLE_HEADERS.length - 1] ?? "").trim();
  const trailing = headerRow
    .slice(PEOPLE_HEADERS.length)
    .some((cell) => String(cell ?? "").trim());

  if (next === COLUMN && !trailing) {
    console.log(`${sheetName} already has ${COLUMN} in column ${PEOPLE_SHEET_WIDTH}. Nothing to write.`);
    return;
  }
  if (next || trailing) {
    throw new Error(
      `Refusing to append. Something is already past the current schema in ${sheetName}.`,
    );
  }

  console.log(
    `${sheetName}: header prefix matches. ${COLUMN} would be written to ${PEOPLE_SHEET_WIDTH}1 only.`,
  );
  if (!APPLY) {
    console.log("DRY RUN — nothing written. Re-run with --apply.");
    return;
  }

  await appendOneColumnIfNeeded(sheets, spreadsheetId, sheetName);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!${PEOPLE_SHEET_WIDTH}1`,
    valueInputOption: "RAW",
    requestBody: { values: [[COLUMN]] },
  });
  console.log(`Wrote ${COLUMN} to ${sheetName}!${PEOPLE_SHEET_WIDTH}1.`);
}

main().catch((error) => {
  console.error("Failed:", error?.message || error);
  process.exit(1);
});
