"use strict";

/**
 * Who is this phone? Voting is anonymous, so a device id stands in for a
 * person. It lives in two places that fail independently:
 *
 *   - an HttpOnly cookie the server sets (survives a cleared localStorage,
 *     and isn't subject to Safari's 7-day cap on script-written cookies)
 *   - localStorage, which the client sends as `voterKey`
 *
 * Either one finding an earlier ballot means "same phone": the ballot is
 * updated, never added. Only a phone that lost both — a fresh private tab,
 * a second device — reads as new. Nothing short of sign-in can tell those
 * apart, and the stored device hint lets a host spot a cluster afterwards.
 */

const crypto = require("crypto");

const COOKIE_NAME = "fa_poll_voter";
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;
const KEY_PATTERN = /^[A-Za-z0-9:_.-]{8,128}$/;

function cleanKey(raw) {
  const value = String(raw || "").trim();
  return KEY_PATTERN.test(value) ? value : "";
}

function readCookie(req, name) {
  const header = String(req?.headers?.cookie || "");
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

function isHttps(req) {
  const proto = String(req?.headers?.["x-forwarded-proto"] || "").split(",")[0].trim();
  return proto === "https" || Boolean(req?.socket?.encrypted);
}

function hashVoterKey(raw) {
  const secret =
    process.env.DIRECTORY_SESSION_SECRET || process.env.SESSION_SECRET || "foresight-atlas-dev";
  return crypto
    .createHash("sha256")
    .update(`${secret}:poll-voter:${String(raw || "").trim()}`)
    .digest("hex")
    .slice(0, 32);
}

function clientIp(req) {
  const forwarded = String(req?.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return String(forwarded || req?.socket?.remoteAddress || "unknown").slice(0, 80);
}

/** Network + browser, hashed. Many phones share it; it's a clue, not an id. */
function deviceHint(req) {
  const ua = String(req?.headers?.["user-agent"] || "").slice(0, 300);
  return hashVoterKey(`hint:${clientIp(req)}:${ua}`).slice(0, 16);
}

/**
 * Settle on one device id for this request, pin it in the cookie, and list
 * every hashed key that might already hold this phone's ballot.
 *
 * @returns {{ deviceKey: string, ballotKey: string, knownKeys: string[], hint: string }}
 */
function resolveVoter(req, res, clientKeyRaw) {
  const cookieKey = cleanKey(readCookie(req, COOKIE_NAME));
  const clientKey = cleanKey(clientKeyRaw);
  const deviceKey = cookieKey || clientKey || crypto.randomUUID();

  if (res && cookieKey !== deviceKey) {
    const attributes = [
      `${COOKIE_NAME}=${encodeURIComponent(deviceKey)}`,
      "Path=/api/polls",
      `Max-Age=${COOKIE_MAX_AGE_S}`,
      "HttpOnly",
      "SameSite=Lax",
    ];
    if (isHttps(req)) attributes.push("Secure");
    res.setHeader("Set-Cookie", attributes.join("; "));
  }

  const ballotKey = hashVoterKey(deviceKey);
  const knownKeys = [...new Set([deviceKey, cookieKey, clientKey].filter(Boolean))].map(
    hashVoterKey,
  );
  return { deviceKey, ballotKey, knownKeys, hint: deviceHint(req) };
}

module.exports = { resolveVoter, hashVoterKey, clientIp };
