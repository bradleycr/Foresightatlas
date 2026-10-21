/**
 * Vercel serverless: GET /api/community-stats
 *
 * Foresight Team only. Aggregates nanowheels, check-ins, RSVPs, claim funnel,
 * geography, connections, and login windows from sheet tabs.
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
const { loadRealDataRecords } = require("../server/realdata-store");
const { parseRoleTypes } = require("../server/role-types");

const TEAM_ROLE = "Foresight Team";
const CACHE_TTL_MS = 60 * 1000;
let cached = null;
let cachedAt = 0;

function personHasTeamRole(person) {
  if (!person) return false;
  const roles =
    Array.isArray(person.roleTypes) && person.roleTypes.length
      ? person.roleTypes
      : parseRoleTypes(person.roleType);
  return roles.includes(TEAM_ROLE);
}

async function requireForesightTeam(req) {
  const session = verifyDirectorySessionToken(readDirectoryTokenFromRequest(req));
  const { records } = await loadRealDataRecords();
  const match = records.find((r) => r.person?.id === session.personId);
  if (!personHasTeamRole(match?.person)) {
    const err = new Error("Foresight Team only.");
    err.statusCode = 403;
    throw err;
  }
  return session;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    await requireForesightTeam(req);
  } catch (error) {
    const status =
      error && typeof error === "object" && typeof error.statusCode === "number"
        ? error.statusCode
        : 401;
    return res.status(status).json({
      error:
        error instanceof Error
          ? error.message
          : status === 403
            ? "Foresight Team only."
            : "Sign in to view community stats.",
    });
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
