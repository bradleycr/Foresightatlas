"use strict";

/**
 * Blunt online guessing against member sign-in.
 *
 * In-memory on purpose: a single warm instance slows a scraper, and a cold
 * start resets the window. The password hash (scrypt) is the real cost.
 * Limits are per client address and per identifier, and the response never
 * says whether that identifier is on the roster.
 */

const { rateLimit } = require("./rate-limit");
const { normalizeLoginIdentifier } = require("./login-identifier");

const WINDOW_MS = 15 * 60 * 1000;
/** A node often shares one address, so this only bounds failures, not sign-ins. */
const IP_LIMIT = 40;
/** Per name or email, so one account cannot be guessed in a tight loop. */
const IDENTIFIER_LIMIT = 8;

function clientAddress(req) {
  const forwarded = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const raw = forwarded || req?.socket?.remoteAddress || req?.ip || "unknown";
  return String(raw).slice(0, 80);
}

function tooMany(retryAfterSec) {
  const err = new Error(
    "Too many sign-in attempts. Wait a few minutes and try again.",
  );
  err.statusCode = 429;
  err.retryAfterSec = retryAfterSec;
  return err;
}

function checkLoginBudget(req, identifier, { record }) {
  const ip = rateLimit(`login:ip:${clientAddress(req)}`, {
    limit: IP_LIMIT,
    windowMs: WINDOW_MS,
    dryRun: !record,
  });
  if (!ip.ok) throw tooMany(ip.retryAfterSec);

  const idKey = normalizeLoginIdentifier(identifier) || "blank";
  const id = rateLimit(`login:id:${idKey}`, {
    limit: IDENTIFIER_LIMIT,
    windowMs: WINDOW_MS,
    dryRun: !record,
  });
  if (!id.ok) throw tooMany(id.retryAfterSec);
}

/** Reject when this address or identifier is already over the failure budget. */
function assertLoginAllowed(req, identifier) {
  checkLoginBudget(req, identifier, { record: false });
}

/** Count a failed attempt. Throws 429 when that attempt crosses the limit. */
function recordLoginFailure(req, identifier) {
  checkLoginBudget(req, identifier, { record: true });
}

module.exports = { assertLoginAllowed, recordLoginFailure };
