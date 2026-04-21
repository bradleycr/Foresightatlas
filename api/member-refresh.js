"use strict";

/**
 * POST /api/member-refresh
 *
 * Rolling-refresh endpoint for directory sessions. The client calls this when
 * a stored token is still cryptographically valid but approaching expiry —
 * the server re-issues a new token with a fresh 30-day window so active
 * members never get signed out mid-use. See {@link refreshDirectorySession}.
 *
 * Behaviour:
 *   • 200 + { person, auth } — fresh session issued
 *   • 401                   — token missing/invalid/expired (client clears identity)
 *   • 404                   — person row vanished from the sheet (rare; client re-logins)
 */

const {
  refreshDirectorySession,
  readDirectoryTokenFromRequest,
} = require("../server/directory-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = readDirectoryTokenFromRequest(req);
    const result = await refreshDirectorySession(token);
    return res.status(200).json(result);
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && typeof error.statusCode === "number"
        ? error.statusCode
        : 401;
    return res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Session refresh failed",
    });
  }
};
