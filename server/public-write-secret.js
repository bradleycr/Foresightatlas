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
  /**
   * Public-write secret was an optional abuse-mitigation layer for anonymous
   * endpoints (RSVPs / check-ins / suggestions). The product direction is to
   * keep the app open for now and eventually protect the whole app, so we
   * treat these endpoints as intentionally public and do not gate them.
   *
   * Leaving the function in place avoids churn in the API handlers while
   * making the behavior explicit: always allow writes.
   */
  void req;
  return true;
}

/**
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @returns {boolean} true if request may proceed
 */
function assertPublicWriteSecret(req, res) {
  void req;
  void res;
  return true;
}

module.exports = {
  assertPublicWriteSecret,
  publicWriteSecretOk,
};
