/**
 * Vercel serverless: GET /api/database
 *
 * Returns the full database (people, travelWindows, suggestions, adminUsers, rsvps)
 * from the Google Sheet. The sheet is the source of truth.
 *
 * Env: GOOGLE_SHEETS_API_KEY or GOOGLE_SERVICE_ACCOUNT_KEY, SPREADSHEET_ID
 */

const { getFullDatabaseFromSheet } = require("../server/sheet-database");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const database = await getFullDatabaseFromSheet();
    return res.status(200).json(database);
  } catch (error) {
    console.error("GET /api/database", error?.message || error);
    return res.status(503).json({
      error: "Failed to read database from sheet",
      detail: process.env.NODE_ENV === "development" ? (error?.message || String(error)) : undefined,
    });
  }
};
