"use strict";

/**
 * How a member proves which roster row is theirs, before the password check.
 *
 * Accepted:
 *   - the email stored on their profile
 *   - their full name, as written
 *   - first and last name, ignoring middle names, initials, and honorifics
 *
 * A miss and a wrong password are reported separately. The roster itself is
 * never listed.
 */

const HONORIFICS = new Set([
  "dr",
  "prof",
  "professor",
  "mr",
  "mrs",
  "ms",
  "mx",
  "sir",
]);

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function looksLikeEmail(value) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120;
}

/** Drop parenthetical notes so "Ada Lovelace (FAR)" still keys as Ada Lovelace. */
function withoutParens(value) {
  return String(value || "").replace(/\([^)]*\)/g, " ");
}

function significantTokens(value) {
  return withoutParens(value)
    .toLowerCase()
    .replace(/['’.]/g, "")
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !HONORIFICS.has(token));
}

/** "David A Leigh" and "David Leigh" share this key. Empty when there is no pair. */
function firstLastKey(value) {
  const tokens = significantTokens(value);
  if (tokens.length < 2) return "";
  return `${tokens[0]} ${tokens[tokens.length - 1]}`;
}

/**
 * Keys a person can be addressed by. Includes a parenthetical alternate
 * ("TJ (Tushant Jha)") so either form works.
 */
function personNameKeys(fullName) {
  const keys = new Set();
  const exact = normalizeName(fullName);
  if (exact) keys.add(`exact:${exact}`);
  const outer = firstLastKey(fullName);
  if (outer) keys.add(`fl:${outer}`);

  const parens = String(fullName || "").matchAll(/\(([^)]+)\)/g);
  for (const match of parens) {
    const innerExact = normalizeName(match[1]);
    if (innerExact) keys.add(`exact:${innerExact}`);
    const inner = firstLastKey(match[1]);
    if (inner) keys.add(`fl:${inner}`);
  }
  return keys;
}

function identifierKeys(identifier) {
  const raw = String(identifier || "").trim();
  const keys = new Set();
  const exact = normalizeName(raw);
  if (exact) keys.add(`exact:${exact}`);
  const fl = firstLastKey(raw);
  if (fl) keys.add(`fl:${fl}`);
  return keys;
}

/** Roster email, plus the calendar address when that cell is also an email. */
function emailsOnFile(person) {
  return [person?.email, person?.calendarEmail]
    .map(normalizeEmail)
    .filter((email) => looksLikeEmail(email));
}

/**
 * @param {{ fullName?: string, email?: string, calendarEmail?: string }} person
 * @param {string} identifier
 */
function identifierMatchesPerson(person, identifier) {
  const raw = String(identifier || "").trim();
  if (!raw || !person) return false;

  if (looksLikeEmail(raw)) {
    const want = normalizeEmail(raw);
    return emailsOnFile(person).includes(want);
  }

  const want = identifierKeys(raw);
  if (want.size === 0) return false;
  const have = personNameKeys(person.fullName);
  for (const key of want) {
    if (have.has(key)) return true;
  }
  return false;
}

/** Stable bucket key for rate limiting. Not a display value. */
function normalizeLoginIdentifier(identifier) {
  const raw = String(identifier || "").trim();
  if (!raw) return "";
  if (looksLikeEmail(raw)) return `email:${normalizeEmail(raw)}`;
  const fl = firstLastKey(raw);
  if (fl) return `name:${fl}`;
  return `name:${normalizeName(raw)}`;
}

function unknownIdentifierMessage(identifier) {
  return looksLikeEmail(identifier)
    ? "We don't have that email on file."
    : "We couldn't find a profile with that name.";
}

const LOGIN_PASSWORD_WRONG = "That password isn't right.";
const LOGIN_NOT_SET_UP =
  "This profile hasn't been set up yet. Open the personal sign-in link you were sent to choose a password.";
const LOGIN_AMBIGUOUS_NAME =
  "More than one profile matches that name. Sign in with the email we have on file.";

module.exports = {
  looksLikeEmail,
  identifierMatchesPerson,
  normalizeLoginIdentifier,
  unknownIdentifierMessage,
  LOGIN_PASSWORD_WRONG,
  LOGIN_NOT_SET_UP,
  LOGIN_AMBIGUOUS_NAME,
};
