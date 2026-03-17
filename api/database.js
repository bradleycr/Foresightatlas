/**
 * Vercel serverless: GET /api/database
 *
 * Returns the full database (people, travelWindows, suggestions, adminUsers, rsvps, events)
 * from the Google Sheet. Events are merged with Luma live (cached 10 min).
 * In-memory cache (60s TTL) per instance reduces sheet reads and speeds repeat loads.
 *
 * Env: GOOGLE_SHEETS_API_KEY or GOOGLE_SERVICE_ACCOUNT_KEY, SPREADSHEET_ID; optional LUMA_API_KEY for events.
 */

const { getFullDatabaseFromSheet } = require("../server/sheet-database");
const { mergeSheetEventsWithLuma } = require("../server/luma-merge");

const CACHE_TTL_MS = 60 * 1000; // 60s per instance (Vercel serverless may reuse the same instance)
let cached = null;
let cachedAt = 0;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const now = Date.now();
    if (cached && now - cachedAt < CACHE_TTL_MS) {
      return res.status(200).json(cached);
    }
    const database = await getFullDatabaseFromSheet();
    database.events = await mergeSheetEventsWithLuma(database.events || []);
    cached = database;
    cachedAt = now;
    return res.status(200).json(database);
  } catch (error) {
    console.error("GET /api/database", error?.message || error);
    const msg = error?.message || "Failed to read database from sheet";
    const hint =
      process.env.NODE_ENV === "development" || process.env.VERCEL
        ? " Set GOOGLE_SHEETS_API_KEY (or GOOGLE_SERVICE_ACCOUNT_KEY) and SPREADSHEET_ID in env. Share sheet 'Anyone with the link can view'. See docs/SHEETS_SYNC.md."
        : "";
    return res.status(503).json({
      error: msg + hint,
      detail: process.env.NODE_ENV === "development" ? (error?.message || String(error)) : undefined,
    });
  }
};
