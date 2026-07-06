/**
 * Vercel serverless: GET /api/community-stats
 *
 * Signed-in members only. Aggregates nanowheels, check-ins, and RSVPs
 * from the CheckIns + RSVPs sheet tabs, broken down by node and month.
 */

const path = require("path");
const fs = require("fs");
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credPath && !fs.existsSync(path.resolve(credPath))) {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const { loadCommunityStatsFromSheet } = require("../server/community-stats");
const {
  verifyDirectorySessionToken,
  readDirectoryTokenFromRequest,
} = require("../server/directory-auth");

const CACHE_TTL_MS = 60 * 1000;
let cached = null;
let cachedAt = 0;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    verifyDirectorySessionToken(readDirectoryTokenFromRequest(req));
  } catch {
    return res.status(401).json({ error: "Sign in to view community stats." });
  }

  try {
    const now = Date.now();
    if (cached && now - cachedAt < CACHE_TTL_MS) {
      return res.status(200).json(cached);
    }
    const stats = await loadCommunityStatsFromSheet();
    cached = stats;
    cachedAt = now;
    return res.status(200).json(stats);
  } catch (error) {
    console.error("GET /api/community-stats", error?.message || error);
    return res.status(503).json({
      error: error instanceof Error ? error.message : "Failed to load community stats.",
    });
  }
};
