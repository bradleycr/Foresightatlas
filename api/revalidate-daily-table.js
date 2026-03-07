/**
 * Vercel serverless: GET /api/revalidate-daily-table?nodeSlug=berlin
 *
 * Returns the current DailyTable for the requested node as fresh JSON.
 * The frontend can SWR-poll this endpoint to live-reload the attendance grid
 * after Signal check-in commands update the sheet.
 *
 * Query params:
 *   nodeSlug  — "berlin" | "sf" (required)
 *
 * Response: JSON array of { Date, UserPhone, UserName, Status, Notes, UpdatedAt }
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const {
  DAILY_TABLE_HEADERS,
  dailyTableTabName,
  getSheetColumnLetter,
} = require("../scripts/sheet-schema");

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ";

async function getSheetsClient() {
  const key = process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return null;
  const auth = new google.auth.GoogleAuth({ apiKey: key });
  return google.sheets({ version: "v4", auth });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { nodeSlug } = req.query || {};
  if (!nodeSlug || !["berlin", "sf"].includes(nodeSlug)) {
    return res.status(400).json({ error: 'nodeSlug query param required ("berlin" or "sf")' });
  }

  const sheets = await getSheetsClient();
  if (!sheets) {
    return res.status(503).json({ error: "Sheet read not configured (missing GOOGLE_SHEETS_API_KEY)" });
  }

  try {
    const tab = dailyTableTabName(nodeSlug);
    const width = getSheetColumnLetter(DAILY_TABLE_HEADERS.length - 1);

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${tab}'!A:${width}`,
    });

    const values = data.values || [];
    if (values.length < 2) {
      return res.status(200).json([]);
    }

    const [headerRow, ...rows] = values;
    const col = (name) => {
      const i = headerRow.findIndex(
        (c) => String(c).trim().toLowerCase() === name.toLowerCase(),
      );
      return i >= 0 ? i : -1;
    };

    const result = rows
      .map((row) => ({
        Date: (row[col("Date")] || "").trim(),
        UserPhone: (row[col("UserPhone")] || "").trim(),
        UserName: (row[col("UserName")] || "").trim(),
        Status: (row[col("Status")] || "").trim(),
        Notes: (row[col("Notes")] || "").trim(),
        UpdatedAt: (row[col("UpdatedAt")] || "").trim(),
      }))
      .filter((r) => r.Date && r.UserPhone);

    /* Cache for 30s so Vercel edge doesn't hammer the Sheets API */
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json(result);
  } catch (e) {
    console.error("GET /api/revalidate-daily-table", e.message);
    return res.status(500).json({ error: "Failed to read DailyTable" });
  }
};
