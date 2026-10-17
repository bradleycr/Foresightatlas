"use strict";

/**
 * Self-serve magic links: name + email → claim or password-reset link on screen.
 *
 * Always returns the same public shape whether or not a match was found
 * (anti-enumeration). Optional Resend (if configured later) can email instead.
 */

const {
  issueClaimToken,
  issuePasswordResetToken,
} = require("./directory-auth");
const { rateLimit } = require("./rate-limit");
const {
  mailConfigured,
  magicLinkMode,
  revealLinksAllowed,
  sendAccessMagicLink,
} = require("./mail");
const {
  isLocalMockMode,
  getLocalDatabase,
  getLocalAuth,
} = require("./local-storage");

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/** Same rules as realdata-store.normalizeName — kept local so mock tests need no sheet env. */
function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildFullName(body) {
  const first = String(body?.firstName || "").trim();
  const last = String(body?.lastName || "").trim();
  const combined = [first, last].filter(Boolean).join(" ");
  const full = String(body?.fullName || combined || "").trim();
  return full;
}

function publicOrigin(req) {
  const fromEnv = (process.env.CLAIM_BASE_URL || "").replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const host = req.headers?.["x-forwarded-host"] || req.headers?.host;
  if (host) {
    const proto =
      req.headers?.["x-forwarded-proto"] ||
      (String(host).includes("localhost") ? "http" : "https");
    return `${proto}://${host}`.replace(/\/+$/, "");
  }
  return "https://atlas.foresight.org";
}

function buildClaimUrl(origin, token) {
  return `${origin}/claim?token=${encodeURIComponent(token)}`;
}

async function loadRosterRecords() {
  if (isLocalMockMode()) {
    const [db, auth] = await Promise.all([getLocalDatabase(), getLocalAuth()]);
    return (db.people || []).map((person) => ({
      person,
      auth: auth[person.id] || { passwordHash: "" },
    }));
  }
  const { loadRealDataRecords } = require("./realdata-store");
  const loaded = await loadRealDataRecords({ write: false });
  return loaded.records || [];
}

/**
 * Find a roster row where full name + email both match.
 * @returns {null | { person: object, auth: object }}
 */
function findMatchingRecord(records, fullName, email) {
  const wantName = normalizeName(fullName);
  const wantEmail = normalizeEmail(email);
  if (!wantName || !wantEmail) return null;

  const hits = records.filter((r) => {
    const person = r.person || r;
    const auth = r.auth || {};
    const nameOk = normalizeName(person.fullName) === wantName;
    const emailOk = normalizeEmail(person.email) === wantEmail;
    return nameOk && emailOk && person.id;
  });
  if (hits.length === 0) return null;
  // Prefer a claimed row if duplicates somehow exist.
  return (
    hits.find((h) => (h.auth || {}).passwordHash) ||
    hits[0]
  );
}

/**
 * @param {import("http").IncomingMessage} req
 * @param {{ firstName?: string, lastName?: string, fullName?: string, email?: string }} body
 */
/** Off while password resets go through a mailto instead of an on-screen link. */
const SELF_SERVE_ACCESS_LINKS = false;

async function requestAccessLink(req, body) {
  if (!SELF_SERVE_ACCESS_LINKS) {
    const paused = new Error(
      "Self-serve magic links are paused. Email the team from the sign-in page and we’ll send a new link.",
    );
    paused.statusCode = 410;
    throw paused;
  }

  const fullName = buildFullName(body || {});
  const email = normalizeEmail(body?.email);
  if (!fullName || fullName.length < 2) {
    const err = new Error("Enter your first and last name.");
    err.statusCode = 400;
    throw err;
  }
  if (!email || !email.includes("@")) {
    const err = new Error("Enter a valid email address.");
    err.statusCode = 400;
    throw err;
  }

  const ip =
    String(req.headers?.["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    req.socket?.remoteAddress ||
    "local";
  const limited = rateLimit(`access-request:${ip}:${email}`, {
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    const err = new Error(
      "Too many requests. Try again in a few minutes.",
    );
    err.statusCode = 429;
    err.retryAfterSec = limited.retryAfterSec;
    throw err;
  }

  const mode = magicLinkMode();
  const reveal = revealLinksAllowed();
  // Anti-enumeration: same copy whether or not a row matched.
  const missMessage =
    mode === "email"
      ? "If we find a matching profile, we’ll email a one-time link shortly. Check spam if it doesn’t arrive."
      : "We couldn’t verify that name and email against the atlas roster. Check the spelling matches the email on file, or email bradley@foresight.org for help.";

  let records;
  try {
    records = await loadRosterRecords();
  } catch (error) {
    console.error("[access-request] roster load failed:", error?.message || error);
    return { ok: true, mode, message: missMessage };
  }

  const match = findMatchingRecord(records, fullName, email);
  if (!match) {
    // Small delay so misses aren't obviously faster than hits.
    await new Promise((r) => setTimeout(r, 400 + Math.floor(Math.random() * 200)));
    return { ok: true, mode, message: missMessage };
  }

  const person = match.person;
  const passwordHash = match.auth?.passwordHash || "";
  const origin = publicOrigin(req);
  const kind = passwordHash ? "reset" : "claim";
  let token;
  try {
    token = passwordHash
      ? issuePasswordResetToken(person.id, passwordHash)
      : issueClaimToken(person.id);
  } catch (error) {
    console.error("[access-request] token issue failed:", error?.message || error);
    return { ok: true, mode, message: missMessage };
  }
  const link = buildClaimUrl(origin, token);

  // Optional Resend path — only when configured. Default is on-screen (no DNS).
  const mail = await sendAccessMagicLink(
    email,
    link,
    kind,
    person.fullName,
  );

  const claimLink = reveal && !mail.sent ? link : undefined;
  const hitMessage = mail.sent
    ? "We emailed a one-time link. Check your inbox (and spam)."
    : kind === "reset"
      ? "Open this one-time link to reset your password."
      : "Open this one-time link to set your password and claim your profile.";

  return {
    ok: true,
    mode,
    message: hitMessage,
    kind,
    ...(claimLink ? { claim_link: claimLink } : {}),
    ...(mail.sent ? { emailed: true } : {}),
  };
}

module.exports = {
  requestAccessLink,
  findMatchingRecord,
  normalizeEmail,
  buildFullName,
  mailConfigured,
};
