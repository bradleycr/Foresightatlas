/**
 * Vercel serverless: upsert a person's directory profile into the canonical Real Data sheet row.
 * Source of truth is the Google Sheet; no static database.json at runtime.
 */

const { saveProfile } = require("../server/profile-store");
const { getDirectorySessionFromRequest } = require("../server/directory-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const session = getDirectorySessionFromRequest(req);
    const result = await saveProfile(req.body?.person, session);
    return res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save profile";
    return res.status(400).json({ error: message });
  }
};
