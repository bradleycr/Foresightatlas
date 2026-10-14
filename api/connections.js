/**
 * Vercel serverless: private connection bookmarks for the signed-in member.
 *
 * GET  /api/connections          → { targetPersonIds: string[] } for session owner
 * POST /api/connections          → { action: "add"|"remove", targetPersonId }
 *
 * Owner is always taken from the directory session — never from the body.
 * Other members' bookmark lists are never returned.
 */

"use strict";

const {
  readDirectoryTokenFromRequest,
  verifyDirectorySessionToken,
} = require("../server/directory-auth");
const {
  listOwnerConnectionIds,
  setConnection,
} = require("../server/connections-store");

function requireSession(req) {
  return verifyDirectorySessionToken(readDirectoryTokenFromRequest(req));
}

function sendError(res, error, fallback) {
  const status =
    error && typeof error === "object" && error.statusCode
      ? error.statusCode
      : 400;
  return res.status(status).json({
    error: error instanceof Error ? error.message : fallback,
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const session = requireSession(req);
    const ownerPersonId = String(session.personId || "").trim();
    if (!ownerPersonId) {
      return res.status(401).json({ error: "Sign in to manage connections." });
    }

    if (req.method === "GET") {
      const targetPersonIds = await listOwnerConnectionIds(ownerPersonId);
      return res.status(200).json({ targetPersonIds });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const action = String(body.action || "").trim().toLowerCase();
      const targetPersonId = String(body.targetPersonId || "").trim();
      if (!targetPersonId) {
        return res.status(400).json({ error: "targetPersonId is required." });
      }
      if (action === "add") {
        await setConnection(ownerPersonId, targetPersonId, "active");
        const targetPersonIds = await listOwnerConnectionIds(ownerPersonId);
        return res.status(200).json({ ok: true, targetPersonIds });
      }
      if (action === "remove") {
        await setConnection(ownerPersonId, targetPersonId, "removed");
        const targetPersonIds = await listOwnerConnectionIds(ownerPersonId);
        return res.status(200).json({ ok: true, targetPersonIds });
      }
      return res
        .status(400)
        .json({ error: 'Unknown action. Use "add" or "remove".' });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error && error.statusCode === 401) {
      return res.status(401).json({ error: "Sign in to manage connections." });
    }
    console.error("api/connections:", error?.message || error);
    return sendError(res, error, "Connection request failed.");
  }
};
