/**
 * Vercel serverless: GET = read RSVPs from sheet. POST = append one RSVP (service account).
 * Env: SPREADSHEET_ID; read: GOOGLE_SHEETS_API_KEY or GOOGLE_SERVICE_ACCOUNT_KEY; write: GOOGLE_SERVICE_ACCOUNT_KEY (or GOOGLE_APPLICATION_CREDENTIALS with valid file).
 */

// If GOOGLE_APPLICATION_CREDENTIALS points to a missing file (e.g. local path on Vercel), clear it
// before loading googleapis so we avoid ENOENT / lstat from the auth library.
const fs = require("fs");
const path = require("path");
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credPath && !fs.existsSync(path.resolve(credPath))) {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const { google } = require("googleapis");
const { getSpreadsheetId } = require("../scripts/sheet-schema.js");
const { assertPublicWriteSecret } = require("../server/public-write-secret.js");
const { normalizeBerlinSecureWorkshopRsvps } = require("../server/event-corrections");

const SPREADSHEET_ID = getSpreadsheetId();
const SHEET_RSVPS = "RSVPs";

/**
 * Allowed RSVP statuses. `withdrawn` lets a user un-click their own RSVP by
 * writing a new row that supersedes the previous "going" / "interested" choice
 * — the sheet is append-only and latest row wins, so a soft delete is the only
 * consistent way to clear an RSVP across tabs and devices.
 *
 * Historic/junk values (empty, unrecognised) default to "going" to preserve
 * the old permissive behaviour.
 */
const VALID_RSVP_STATUSES = new Set(["going", "interested", "not-going", "withdrawn"]);
const normaliseStatus = (raw) => {
  const s = String(raw || "").trim();
  return VALID_RSVP_STATUSES.has(s) ? s : "going";
};

/**
 * Parse raw sheet rows into RSVP records.
 *
 * Returns every row (not just the latest) from the helper, but keys the final
 * map by (eventId, personId) to collapse the append-only log into a single
 * current-state record per user per event. `allRows` is returned alongside
 * so callers that want history (e.g. `preserve createdAt`) don't need a second
 * pass.
 */
function parseRsvpRows(values) {
  if (!values || values.length < 2) return { latest: [], allRows: [] };
  const [headerRow, ...rows] = values;
  const col = (name) => {
    const i = headerRow.findIndex((c) => String(c).trim().toLowerCase() === name.toLowerCase());
    return i >= 0 ? i : -1;
  };
  const allRows = rows
    .map((row) => {
      const eventId = row[col("eventId")] != null ? String(row[col("eventId")]).trim() : "";
      const personId = row[col("personId")] != null ? String(row[col("personId")]).trim() : "";
      if (!eventId || !personId) return null;
      return {
        eventId,
        eventTitle: row[col("eventTitle")] != null ? String(row[col("eventTitle")]).trim() : "",
        personId,
        fullName: row[col("fullName")] != null ? String(row[col("fullName")]).trim() : "",
        status: normaliseStatus(row[col("status")]),
        createdAt:
          row[col("createdAt")] != null
            ? String(row[col("createdAt")]).trim()
            : new Date().toISOString(),
        updatedAt:
          row[col("updatedAt")] != null
            ? String(row[col("updatedAt")]).trim()
            : new Date().toISOString(),
      };
    })
    .filter(Boolean);
  // Sheet is append-only: same person can have multiple rows per event. Keep one per (eventId, personId), latest by updatedAt.
  const byKey = new Map();
  for (const r of allRows) {
    const key = `${r.eventId}\t${r.personId}`;
    const existing = byKey.get(key);
    if (!existing || new Date(r.updatedAt) > new Date(existing.updatedAt)) byKey.set(key, r);
  }
  return { latest: Array.from(byKey.values()), allRows };
}

/**
 * When a user updates an existing RSVP, we want the sheet row's `createdAt`
 * to reflect when they first RSVP'd — not the time of every edit. Returns
 * the earliest `createdAt` across all prior rows for (eventId, personId),
 * falling back to a default (typically "now") when no prior row exists.
 */
function pickEarliestCreatedAt(allRows, eventId, personId, fallback) {
  let best = null;
  for (const row of allRows) {
    if (row.eventId !== eventId || row.personId !== personId) continue;
    const ts = new Date(row.createdAt).getTime();
    if (!Number.isFinite(ts)) continue;
    if (best === null || ts < best.ts) best = { ts, iso: row.createdAt };
  }
  return best ? best.iso : fallback;
}

async function getSheetsClientForRead() {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey) {
    const auth = new google.auth.GoogleAuth({ apiKey });
    return google.sheets({ version: "v4", auth });
  }
  // Fall back to service account so one env var (GOOGLE_SERVICE_ACCOUNT_KEY) works for read + write.
  return getSheetsClientForWrite();
}

async function getSheetsClientForWrite() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let key = null;
  if (keyJson) {
    try {
      key = JSON.parse(keyJson);
    } catch {
      return null;
    }
  } else if (keyPath) {
    const resolved = path.resolve(keyPath);
    if (fs.existsSync(resolved)) {
      try {
        key = JSON.parse(fs.readFileSync(resolved, "utf8"));
      } catch (e) {
        console.error("GOOGLE_APPLICATION_CREDENTIALS read failed:", e.message);
        return null;
      }
    } else {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  }
  if (!key) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Foresight-Write-Secret, Authorization",
  );
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    const sheets = await getSheetsClientForRead();
    if (!sheets) return res.status(503).json({ error: "RSVP read not configured (missing GOOGLE_SHEETS_API_KEY or GOOGLE_SERVICE_ACCOUNT_KEY)" });
    try {
      const { data } = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_RSVPS}'!A:G`,
      });
      const { latest } = parseRsvpRows(data.values || []);
      const rsvps = normalizeBerlinSecureWorkshopRsvps(latest);
      return res.status(200).json(rsvps);
    } catch (e) {
      console.error("GET /api/rsvps", e.message);
      return res.status(500).json({ error: "Failed to read RSVPs" });
    }
  }

  if (req.method === "POST") {
    if (!assertPublicWriteSecret(req, res)) return;
    const sheets = await getSheetsClientForWrite();
    if (!sheets) return res.status(503).json({ error: "RSVP write not configured (missing GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS)" });
    const { eventId, eventTitle, personId, fullName, status } = req.body || {};
    if (!eventId || !personId) return res.status(400).json({ error: "eventId and personId required" });
    const statusToSave = normaliseStatus(status || "going");
    const now = new Date().toISOString();

    /*
     * Preserve the original RSVP's `createdAt`. The sheet is append-only, so
     * each update writes a new row — without this lookup, every edit would
     * show the same timestamp in both columns and we'd lose the "first RSVP'd
     * on..." signal that UIs and reports can use.
     *
     * The extra GET adds a single round-trip per write; for a small community
     * sheet this is acceptable. If we ever grow out of Google Sheets this
     * disappears entirely (a DB would just `UPDATE ... RETURNING createdAt`).
     */
    let createdAt = now;
    try {
      const { data } = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_RSVPS}'!A:G`,
      });
      const { allRows } = parseRsvpRows(data.values || []);
      createdAt = pickEarliestCreatedAt(allRows, eventId, personId, now);
    } catch (e) {
      // Non-fatal: fall back to `now` and continue with the write.
      console.warn("POST /api/rsvps: could not preload rows for createdAt lookup:", e.message);
    }

    const row = [
      eventId,
      eventTitle != null ? String(eventTitle).trim() : "",
      personId,
      fullName || "",
      statusToSave,
      createdAt,
      now,
    ];
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_RSVPS}'!A:G`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
      return res.status(201).json({
        eventId,
        eventTitle: eventTitle != null ? String(eventTitle).trim() : "",
        personId,
        fullName: fullName || "",
        status: statusToSave,
        createdAt,
        updatedAt: now,
      });
    } catch (e) {
      console.error("POST /api/rsvps", e.message);
      return res.status(500).json({ error: "Failed to save RSVP" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
