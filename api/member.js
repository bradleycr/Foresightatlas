"use strict";

/**
 * Unified member / directory auth API (Vercel Hobby plan: one function, many routes).
 *
 * Rewrites in vercel.json map legacy paths here via ?route=…
 *   login, refresh, claim, password, register, invite-claim, directory-names (retired),
 *   access-request
 */

const { createProfile } = require("../server/profile-store");
const { assertLoginAllowed, recordLoginFailure } = require("../server/login-guard");
const {
  authenticateDirectoryLogin,
  refreshDirectorySession,
  peekClaimToken,
  claimDirectoryProfile,
  changeDirectoryPassword,
  personFromRegisterInvite,
  peekInviteClaim,
  claimProfileWithInvite,
  readDirectoryTokenFromRequest,
} = require("../server/directory-auth");
const { requestAccessLink } = require("../server/access-request");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", CORS["Access-Control-Allow-Methods"]);
  res.setHeader("Access-Control-Allow-Headers", CORS["Access-Control-Allow-Headers"]);
}

function routeFromRequest(req) {
  if (req.query?.route) return String(req.query.route);
  const path = String(req.url || "").split("?")[0];
  const segment = path.replace(/^\/api\//, "").replace(/\/$/, "");
  return segment || "member";
}

async function handleLogin(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const identifier = req.body?.username;
  try {
    assertLoginAllowed(req, identifier);
    const result = await authenticateDirectoryLogin(identifier, req.body?.password);
    return res.status(200).json(result);
  } catch (error) {
    let failure = error;
    if (!(failure && failure.statusCode === 429)) {
      try {
        recordLoginFailure(req, identifier);
      } catch (limitError) {
        failure = limitError;
      }
    }
    const status =
      failure && typeof failure === "object" && failure.statusCode === 429 ? 429 : 401;
    if (status === 429 && failure.retryAfterSec) {
      res.setHeader("Retry-After", String(failure.retryAfterSec));
    }
    return res.status(status).json({
      error: failure instanceof Error ? failure.message : "Sign-in failed",
    });
  }
}

async function handleRefresh(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const token = readDirectoryTokenFromRequest(req);
    const result = await refreshDirectorySession(token);
    return res.status(200).json(result);
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && typeof error.statusCode === "number"
        ? error.statusCode
        : 401;
    return res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Session refresh failed",
    });
  }
}

async function handleClaim(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const token = req.body?.token;
  const newPassword = req.body?.newPassword;
  try {
    if (typeof newPassword === "string" && newPassword.length > 0) {
      const result = await claimDirectoryProfile(token, newPassword, {
        email: req.body?.email,
      });
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
}

async function handlePassword(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const token =
      req.body?.token ||
      (typeof req.headers.authorization === "string"
        ? req.headers.authorization.replace(/^Bearer\s+/i, "")
        : "");
    const result = await changeDirectoryPassword(
      token,
      req.body?.currentPassword,
      req.body?.newPassword,
    );
    return res.status(200).json(result);
  } catch (error) {
    const status =
      error && typeof error === "object" && error.statusCode === 401 ? 401 : 400;
    return res.status(status).json({
      error:
        error instanceof Error ? error.message : "Failed to change password",
    });
  }
}

async function handleRegister(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { person, password, inviteToken } = req.body || {};
    const gated = personFromRegisterInvite(person, inviteToken);
    const result = await createProfile(gated, password);
    return res.status(200).json(result);
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && typeof error.statusCode === "number"
        ? error.statusCode
        : 400;
    return res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Registration failed",
      ...(error && typeof error === "object" && error.code ? { code: error.code } : {}),
    });
  }
}

async function handleInviteClaim(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { inviteToken, fullName, email, password } = req.body || {};
    if (typeof password === "string" && password.length > 0) {
      const result = await claimProfileWithInvite(
        inviteToken,
        fullName,
        email,
        password,
      );
      return res.status(200).json(result);
    }
    const result = await peekInviteClaim(inviteToken, fullName);
    return res.status(200).json(result);
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && typeof error.statusCode === "number"
        ? error.statusCode
        : 400;
    return res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Could not claim this profile",
    });
  }
}

async function handleDirectoryNames(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  // Was a public id + fullName dump for the sign-in typeahead. That list is
  // the roster. Keep the route so old clients fail closed instead of hanging.
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(410).json({
    error: "Directory names are not available before sign-in.",
  });
}

async function handleAccessRequest(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const result = await requestAccessLink(req, req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && typeof error.statusCode === "number"
        ? error.statusCode
        : 400;
    if (statusCode === 429 && error.retryAfterSec) {
      res.setHeader("Retry-After", String(error.retryAfterSec));
    }
    return res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Could not request a link",
    });
  }
}

const ROUTES = {
  login: handleLogin,
  refresh: handleRefresh,
  claim: handleClaim,
  password: handlePassword,
  register: handleRegister,
  "invite-claim": handleInviteClaim,
  "directory-names": handleDirectoryNames,
  "access-request": handleAccessRequest,
};

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const route = routeFromRequest(req);
  const handle = ROUTES[route];
  if (!handle) {
    return res.status(404).json({ error: "Unknown member route" });
  }
  return handle(req, res);
};
