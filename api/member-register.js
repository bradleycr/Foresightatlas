"use strict";

/**
 * Vercel serverless: self-register a new directory profile.
 * Appends a row to the RealData sheet and returns a session so the user is signed in.
 */

const { createProfile } = require("../server/profile-store");
const { verifyRegisterToken } = require("../server/directory-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { person, password, inviteToken } = req.body || {};
    // Registration is invite-only — no public "create account".
    verifyRegisterToken(inviteToken);
    const result = await createProfile(person, password);
    return res.status(200).json(result);
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && typeof error.statusCode === "number"
        ? error.statusCode
        : 400;
    const message =
      error instanceof Error ? error.message : "Registration failed";
    return res.status(statusCode).json({ error: message });
  }
};
