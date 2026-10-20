/**
 * Vercel serverless: GET /api/database
 *
 * scope=map reads people and travel live from the sheet (no Luma).
 * scope=programming reads events, merges Luma live, and returns RSVPs.
 * No scope returns the full payload. Nothing is written to a JSON file.
 * In-memory cache (60s TTL) per instance reduces repeat sheet reads.
 *
 * Env: GOOGLE_SHEETS_API_KEY or GOOGLE_SERVICE_ACCOUNT_KEY, SPREADSHEET_ID; optional LUMA_API_KEY for events.
 */

// If GOOGLE_APPLICATION_CREDENTIALS points to a missing file (e.g. local path on Vercel), clear it
// before loading any Google client so we avoid ENOENT / lstat from the auth library.
const path = require("path");
const fs = require("fs");
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credPath && !fs.existsSync(path.resolve(credPath))) {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const { atlasScope, readAtlasDatabase } = require("../server/atlas-read");
const {
  verifyDirectorySessionToken,
  readDirectoryTokenFromRequest,
} = require("../server/directory-auth");

const CACHE_TTL_MS = 60 * 1000; // 60s per instance (Vercel serverless may reuse the same instance)
/** @type {Record<string, { at: number, value: unknown }>} */
const cachedByScope = {};

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  // Member data is private — never let a CDN or shared cache hold it.
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // The atlas is an internal tool: a valid member session is required.
  try {
    verifyDirectorySessionToken(readDirectoryTokenFromRequest(req));
  } catch {
    return res.status(401).json({ error: "Sign in to view the directory." });
  }

  try {
    const scope = atlasScope(req.query?.scope);
    const now = Date.now();
    const hit = cachedByScope[scope];
    if (hit && now - hit.at < CACHE_TTL_MS) {
      return res.status(200).json(hit.value);
    }
    const database = await readAtlasDatabase(scope);
    cachedByScope[scope] = { at: now, value: database };
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
