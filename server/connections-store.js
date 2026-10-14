/**
 * Personal connection bookmarks — private to the signed-in owner.
 *
 * Sheet tab "Connections" (auto-created):
 *   ownerPersonId | targetPersonId | status | createdAt | updatedAt
 *
 * Append-only; latest row per (owner, target) wins. status is "active" or
 * "removed". Never merged into GET /api/database.
 */

"use strict";

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
  CONNECTIONS_HEADERS,
} = require("../scripts/sheet-schema.js");
const {
  isLocalMockMode,
  listLocalConnections,
  appendLocalConnection,
} = require("./local-storage");

const STATUSES = new Set(["active", "removed"]);

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
    throw new Error("Missing Google Sheets credentials for connections.");
  }
  if (write) {
    throw new Error(
      "Writing connections requires GOOGLE_SERVICE_ACCOUNT_KEY (API key is read-only).",
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

async function ensureConnectionsSheet(sheets) {
  const spreadsheetId = sheetsId();
  const title = SHEET_NAMES.CONNECTIONS;
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
    range: `'${title}'!A1:E1`,
    valueInputOption: "RAW",
    requestBody: { values: [CONNECTIONS_HEADERS] },
  });
}

function parseConnectionRows(values) {
  if (!values || values.length < 2) return [];
  const [headerRow, ...rows] = values;
  return rows
    .map((row) => {
      const ownerPersonId = cell(row, headerRow, "ownerPersonId");
      const targetPersonId = cell(row, headerRow, "targetPersonId");
      const statusRaw = cell(row, headerRow, "status").toLowerCase() || "active";
      const status = STATUSES.has(statusRaw) ? statusRaw : "active";
      if (!ownerPersonId || !targetPersonId) return null;
      return {
        ownerPersonId,
        targetPersonId,
        status,
        createdAt: cell(row, headerRow, "createdAt") || "",
        updatedAt: cell(row, headerRow, "updatedAt") || "",
      };
    })
    .filter(Boolean);
}

/** Latest row per (owner, target). */
function dedupeLatest(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.ownerPersonId}\t${row.targetPersonId}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
      continue;
    }
    const prevTs = new Date(prev.updatedAt || 0).getTime();
    const nextTs = new Date(row.updatedAt || 0).getTime();
    if (!Number.isFinite(prevTs) || nextTs >= prevTs) byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

async function loadSheetRows({ write = false } = {}) {
  const sheets = await getSheetsClient({ write });
  const spreadsheetId = sheetsId();
  const title = SHEET_NAMES.CONNECTIONS;
  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${title}'!A:E`,
    });
    return { sheets, rows: parseConnectionRows(data.values || []) };
  } catch (err) {
    if (!isMissingSheetError(err)) throw err;
    if (!write) return { sheets, rows: [] };
    await ensureConnectionsSheet(sheets);
    return { sheets, rows: [] };
  }
}

/**
 * Active target person IDs for one owner. Never returns other owners' edges.
 * @param {string} ownerPersonId
 * @returns {Promise<string[]>}
 */
async function listOwnerConnectionIds(ownerPersonId) {
  const owner = String(ownerPersonId || "").trim();
  if (!owner) return [];

  if (isLocalMockMode()) {
    const rows = dedupeLatest(await listLocalConnections(owner));
    return rows
      .filter((r) => r.status === "active")
      .map((r) => r.targetPersonId);
  }

  const { rows } = await loadSheetRows({ write: false });
  return dedupeLatest(rows)
    .filter((r) => r.ownerPersonId === owner && r.status === "active")
    .map((r) => r.targetPersonId);
}

/**
 * @param {string} ownerPersonId
 * @param {string} targetPersonId
 * @param {"active"|"removed"} status
 */
async function setConnection(ownerPersonId, targetPersonId, status) {
  const owner = String(ownerPersonId || "").trim();
  const target = String(targetPersonId || "").trim();
  const nextStatus = STATUSES.has(status) ? status : "active";
  if (!owner || !target) {
    const err = new Error("ownerPersonId and targetPersonId are required.");
    err.statusCode = 400;
    throw err;
  }
  if (owner === target) {
    const err = new Error("You cannot bookmark yourself.");
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();

  if (isLocalMockMode()) {
    const existing = dedupeLatest(await listLocalConnections(owner)).find(
      (r) => r.targetPersonId === target,
    );
    const row = {
      ownerPersonId: owner,
      targetPersonId: target,
      status: nextStatus,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await appendLocalConnection(row);
    return row;
  }

  const { sheets, rows } = await loadSheetRows({ write: true });
  await ensureConnectionsSheet(sheets);
  const existing = dedupeLatest(rows).find(
    (r) => r.ownerPersonId === owner && r.targetPersonId === target,
  );
  const row = {
    ownerPersonId: owner,
    targetPersonId: target,
    status: nextStatus,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetsId(),
    range: `'${SHEET_NAMES.CONNECTIONS}'!A:E`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          row.ownerPersonId,
          row.targetPersonId,
          row.status,
          row.createdAt,
          row.updatedAt,
        ],
      ],
    },
  });
  return row;
}

module.exports = {
  listOwnerConnectionIds,
  setConnection,
  CONNECTIONS_HEADERS,
};
