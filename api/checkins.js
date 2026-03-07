/**
 * Vercel serverless: GET = read check-ins from Google Sheet. POST = append one check-in.
 *
 * Sheet tab: "CheckIns"
 * Columns:   personId | fullName | nodeSlug | date | type | createdAt | updatedAt
 *
 * GET accepts optional query params: nodeSlug, startDate, endDate to filter results.
 * POST expects JSON body with at minimum: personId, fullName, nodeSlug, date.
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ";
const SHEET_CHECKINS = "CheckIns";

function parseCheckInRows(values, filters) {
  if (!values || values.length < 2) return [];
  const [headerRow, ...rows] = values;
  const col = (name) => {
    const i = headerRow.findIndex(
      (c) => String(c).trim().toLowerCase() === name.toLowerCase(),
    );
    return i >= 0 ? i : -1;
  };

  return rows
    .map((row) => {
      const personId =
        row[col("personId")] != null ? String(row[col("personId")]).trim() : "";
      const nodeSlug =
        row[col("nodeSlug")] != null ? String(row[col("nodeSlug")]).trim() : "";
      const date =
        row[col("date")] != null ? String(row[col("date")]).trim() : "";
      if (!personId || !nodeSlug || !date) return null;

      return {
        personId,
        fullName:
          row[col("fullName")] != null
            ? String(row[col("fullName")]).trim()
            : "",
        nodeSlug,
        date,
        type:
          (row[col("type")] != null
            ? String(row[col("type")]).trim()
            : "checkin") || "checkin",
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
    .filter(Boolean)
    .filter((r) => {
      if (filters.nodeSlug && r.nodeSlug !== filters.nodeSlug) return false;
      if (filters.startDate && r.date < filters.startDate) return false;
      if (filters.endDate && r.date > filters.endDate) return false;
      return true;
    });
}

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
    try {
      key = JSON.parse(keyJson);
    } catch {
      return null;
    }
  } else if (keyPath) {
    try {
      key = JSON.parse(fs.readFileSync(path.resolve(keyPath), "utf8"));
    } catch (e) {
      console.error("GOOGLE_APPLICATION_CREDENTIALS read failed:", e.message);
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

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    const sheets = await getSheetsClientForRead();
    if (!sheets)
      return res
        .status(503)
        .json({ error: "CheckIn read not configured (missing GOOGLE_SHEETS_API_KEY)" });

    const { nodeSlug, startDate, endDate } = req.query || {};
    try {
      const { data } = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_CHECKINS}'!A:G`,
      });
      const checkins = parseCheckInRows(data.values || [], {
        nodeSlug,
        startDate,
        endDate,
      });
      return res.status(200).json(checkins);
    } catch (e) {
      console.error("GET /api/checkins", e.message);
      return res.status(500).json({ error: "Failed to read check-ins" });
    }
  }

  if (req.method === "POST") {
    const sheets = await getSheetsClientForWrite();
    if (!sheets)
      return res.status(503).json({
        error:
          "CheckIn write not configured (missing GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS)",
      });

    const { personId, fullName, nodeSlug, date, type } = req.body || {};
    if (!personId || !nodeSlug || !date)
      return res
        .status(400)
        .json({ error: "personId, nodeSlug, and date required" });

    const now = new Date().toISOString();
    const row = [
      personId,
      fullName || "",
      nodeSlug,
      date,
      type || "checkin",
      now,
      now,
    ];

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_CHECKINS}'!A:G`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
      return res.status(201).json({
        personId,
        fullName: fullName || "",
        nodeSlug,
        date,
        type: type || "checkin",
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      console.error("POST /api/checkins", e.message);
      return res.status(500).json({ error: "Failed to save check-in" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
