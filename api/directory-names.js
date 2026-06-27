"use strict";

/**
 * GET /api/directory-names
 *
 * Public, minimal sign-in picker data: [{ id, fullName }] only. This is the
 * one endpoint that works before authentication so the login form can offer
 * name autocomplete. All richer data lives behind /api/database (session
 * required). Senior Fellows and private profiles are omitted.
 */

const { getDirectoryNamesFromSheet } = require("../server/sheet-database");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  // Short cache — the roster changes rarely and this is non-sensitive.
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const names = await getDirectoryNamesFromSheet();
    return res.status(200).json({ people: names });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load directory names";
    return res.status(503).json({ error: message });
  }
};
