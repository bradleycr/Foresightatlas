"use strict";

/**
 * Optional abuse mitigation for POST /api/rsvps and POST /api/checkins.
 * If FORESIGHT_PUBLIC_WRITE_SECRET is set, requests must send the same value
 * in X-Foresight-Write-Secret or Authorization: Bearer <secret>.
 * Pair with VITE_FORESIGHT_WRITE_SECRET in the frontend build when using this.
 */

function getProvidedSecret(req) {
  const header = req.headers["x-foresight-write-secret"];
  if (typeof header === "string" && header.length > 0) return header;
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

function publicWriteSecretOk(req) {
  const required = process.env.FORESIGHT_PUBLIC_WRITE_SECRET;
  if (!required || String(required).trim() === "") return true;
  return getProvidedSecret(req) === String(required);
}

/**
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @returns {boolean} true if request may proceed
 */
function assertPublicWriteSecret(req, res) {
  if (publicWriteSecretOk(req)) return true;
  res.status(403).json({ error: "Write secret required" });
  return false;
}

module.exports = {
  assertPublicWriteSecret,
  publicWriteSecretOk,
};
