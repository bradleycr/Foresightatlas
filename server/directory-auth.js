"use strict";

const crypto = require("crypto");
const {
  loadRealDataRecords,
  findRecordsByNormalizedName,
  chooseCanonicalRecord,
  cloneRecord,
  upsertRealDataRecord,
} = require("./realdata-store");

const DEFAULT_DIRECTORY_PASSWORD =
  process.env.DIRECTORY_DEFAULT_PASSWORD || "password123";
const SESSION_SECRET =
  process.env.DIRECTORY_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  "foresightmap-directory-session-secret";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function getSessionSignature(encodedPayload) {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");
}

function issueDirectorySession(record) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const payload = {
    personId: record.person.id,
    fullName: record.person.fullName,
    mustChangePassword: !!record.auth.mustChangePassword,
    exp: expiresAt,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = getSessionSignature(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt,
    mustChangePassword: payload.mustChangePassword,
  };
}

function verifyDirectorySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    throw new Error("Missing directory session.");
  }

  const [encodedPayload, signature] = token.split(".");
  const expected = getSessionSignature(encodedPayload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature || "");
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error("Invalid directory session.");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (!payload.exp || new Date(payload.exp).getTime() <= Date.now()) {
    throw new Error("Your directory session has expired. Please sign in again.");
  }

  return payload;
}

function readDirectoryTokenFromRequest(req) {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  if (typeof req?.body?.token === "string") return req.body.token;
  return "";
}

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt);
  return `s2$${salt}$${derivedKey.toString("hex")}`;
}

async function verifyPasswordHash(password, storedHash) {
  const normalized = String(storedHash || "");
  const [version, salt, hash] = normalized.split("$");
  if (version !== "s2" || !salt || !hash) return false;

  const derivedKey = await scryptAsync(password, salt);
  const actual = Buffer.from(hash, "hex");
  if (actual.length !== derivedKey.length) return false;
  return crypto.timingSafeEqual(actual, derivedKey);
}

function validateNewPassword(newPassword) {
  const password = String(newPassword || "");
  if (password.length < 8) {
    throw new Error("Choose a password with at least 8 characters.");
  }
  if (password === DEFAULT_DIRECTORY_PASSWORD) {
    throw new Error("Choose a password different from the default password.");
  }
  return password;
}

async function authenticateDirectoryLogin(fullName, password) {
  const submittedName = String(fullName || "").trim();
  const submittedPassword = String(password || "");
  if (!submittedName) {
    throw new Error("Full name is required.");
  }

  const { records } = await loadRealDataRecords();
  const matches = findRecordsByNormalizedName(records, submittedName);
  const record = chooseCanonicalRecord(matches);
  if (!record) {
    throw new Error("We could not find a directory profile with that full name.");
  }

  const passwordHash = record.auth.passwordHash;
  // No hash yet = first-time login: accept the default temporary password (password123).
  const isValid = passwordHash
    ? await verifyPasswordHash(submittedPassword, passwordHash)
    : submittedPassword === DEFAULT_DIRECTORY_PASSWORD;

  if (!isValid) {
    throw new Error("Incorrect password.");
  }

  const sessionRecord = cloneRecord(record);
  if (!sessionRecord.auth.passwordHash) {
    sessionRecord.auth.mustChangePassword = true;
  }

  const session = issueDirectorySession(sessionRecord);
  return {
    person: record.person,
    auth: session,
  };
}

async function changeDirectoryPassword(token, currentPassword, nextPassword) {
  const session = verifyDirectorySessionToken(token);
  const normalizedCurrentPassword = String(currentPassword || "");
  const validatedNextPassword = validateNewPassword(nextPassword);

  const loaded = await loadRealDataRecords({ write: true });
  const match = loaded.records.find(
    (record) => record.person.id === session.personId,
  );

  if (!match) {
    throw new Error("We could not find your RealData row.");
  }

  const validCurrentPassword = match.auth.passwordHash
    ? await verifyPasswordHash(normalizedCurrentPassword, match.auth.passwordHash)
    : normalizedCurrentPassword === DEFAULT_DIRECTORY_PASSWORD; // First-time: current password is password123

  if (!validCurrentPassword) {
    throw new Error("Current password is incorrect.");
  }

  const now = new Date().toISOString();
  const updated = cloneRecord(match);
  updated.auth.passwordHash = await hashPassword(validatedNextPassword);
  updated.auth.mustChangePassword = false;
  updated.auth.claimedAt = updated.auth.claimedAt || now;
  updated.auth.lastPasswordChangedAt = now;

  await upsertRealDataRecord(loaded.sheets, loaded.sheetName, updated);

  return {
    person: updated.person,
    auth: issueDirectorySession(updated),
  };
}

function getDirectorySessionFromRequest(req) {
  return verifyDirectorySessionToken(readDirectoryTokenFromRequest(req));
}

module.exports = {
  DEFAULT_DIRECTORY_PASSWORD,
  authenticateDirectoryLogin,
  changeDirectoryPassword,
  getDirectorySessionFromRequest,
  issueDirectorySession,
  verifyDirectorySessionToken,
  readDirectoryTokenFromRequest,
  hashPassword,
  verifyPasswordHash,
};
