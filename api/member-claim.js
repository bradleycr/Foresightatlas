"use strict";

/**
 * POST /api/member-claim
 *
 * Magic-link profile claim. One endpoint, two modes based on the body:
 *
 *   { token }                → peek: returns { person: {id, fullName}, alreadyClaimed }
 *   { token, newPassword }   → claim: sets the first password, returns { person, auth }
 *
 * The token is a signed, per-person claim link (see server/directory-auth.js).
 * Claims are one-time-use: once a profile has a password the link is dead and
 * the member signs in normally.
 */

const {
  peekClaimToken,
  claimDirectoryProfile,
} = require("../server/directory-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.body?.token;
  const newPassword = req.body?.newPassword;

  try {
    if (typeof newPassword === "string" && newPassword.length > 0) {
      const result = await claimDirectoryProfile(token, newPassword);
      return res.status(200).json(result);
    }
    const result = await peekClaimToken(token);
    return res.status(200).json(result);
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && typeof error.statusCode === "number"
        ? error.statusCode
        : 400;
    return res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Claim failed",
    });
  }
};
