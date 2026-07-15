/**
 * Self-serve password reset / claim email.
 *
 * Member submits the roster email on file. If we find a match:
 *   • Already claimed → one-time 24h reset link (/claim?token=…)
 *   • Never claimed   → claim link (set first password)
 *
 * Always returns the same opaque success message so lookups can't be used to
 * enumerate who is on the roster. Rate-limited per IP + email.
 */

"use strict";

const { loadRealDataRecords } = require("./realdata-store");
const { getLocalDatabase, isLocalMockMode } = require("./local-storage");
const {
  issueClaimToken,
  issuePasswordResetToken,
} = require("./directory-auth");
const { isMailConfigured, sendMail } = require("./mail");

const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;

/** @type {Map<string, number[]>} */
const buckets = new Map();

function prune(key, now) {
  const list = (buckets.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  buckets.set(key, list);
  return list;
}

function hitRateLimit(key, max) {
  const now = Date.now();
  const list = prune(key, now);
  if (list.length >= max) return true;
  list.push(now);
  buckets.set(key, list);
  return false;
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function siteBaseUrl() {
  return String(
    process.env.CLAIM_BASE_URL ||
      process.env.PUBLIC_APP_URL ||
      "https://foresightatlas.vercel.app",
  ).replace(/\/+$/, "");
}

function publicSuccessMessage() {
  return {
    ok: true,
    message:
      "If that email is on file with a matching Atlas profile, you'll get a magic link shortly. Check spam if you don't see it.",
  };
}

/**
 * @param {{ email: string, clientIp?: string }} input
 */
async function requestPasswordResetEmail(input) {
  const email = normalizeEmail(input.email);
  const ip = String(input.clientIp || "unknown").slice(0, 64);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error("Enter a valid email address.");
    err.statusCode = 400;
    throw err;
  }

  if (!isMailConfigured()) {
    const err = new Error(
      "Password reset email isn't configured on the server yet. Ask an admin to mint a reset link, or set RESEND_API_KEY / SMTP_* env vars.",
    );
    err.statusCode = 503;
    throw err;
  }

  if (hitRateLimit(`email:${email}`, MAX_PER_EMAIL) || hitRateLimit(`ip:${ip}`, MAX_PER_IP)) {
    // Same opaque body — don't confirm that the rate limit was the reason.
    return publicSuccessMessage();
  }

  let match = null;
  try {
    if (isLocalMockMode()) {
      const db = await getLocalDatabase();
      match =
        (db.people || []).find((p) => normalizeEmail(p.email) === email) || null;
      if (match) {
        match = {
          person: match,
          auth: {
            passwordHash: match.passwordHash || null,
            mustChangePassword: !!match.mustChangePassword,
          },
        };
      }
    } else {
      const { records } = await loadRealDataRecords({ write: false });
      match =
        records.find((r) => normalizeEmail(r.person?.email) === email) || null;
    }
  } catch (err) {
    console.warn("password-reset: roster lookup failed:", err?.message || err);
    return publicSuccessMessage();
  }

  if (!match) {
    return publicSuccessMessage();
  }

  const base = siteBaseUrl();
  let url;
  let subject;
  let blurb;

  if (match.auth?.passwordHash) {
    const token = issuePasswordResetToken(match.person.id, match.auth.passwordHash);
    url = `${base}/claim?token=${encodeURIComponent(token)}`;
    subject = "Reset your Foresight Atlas password";
    blurb =
      "Use this one-time link to choose a new password. It expires in 24 hours and stops working once you reset.";
  } else {
    const token = issueClaimToken(match.person.id);
    url = `${base}/claim?token=${encodeURIComponent(token)}`;
    subject = "Set up your Foresight Atlas password";
    blurb =
      "You haven't set a password yet. Use this one-time link to claim your profile and choose one.";
  }

  const text = [
    `Hi ${match.person.fullName.split(/\s+/)[0] || "there"},`,
    "",
    blurb,
    "",
    url,
    "",
    "If you didn't ask for this, you can ignore this email — your account stays as-is.",
    "",
    "— The Foresight Atlas",
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(match.person.fullName.split(/\s+/)[0] || "there")},</p>
    <p>${escapeHtml(blurb)}</p>
    <p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>
    <p style="color:#64748b;font-size:13px">If you didn't ask for this, you can ignore this email.</p>
    <p>— The Foresight Atlas</p>
  `;

  try {
    await sendMail({ to: email, subject, text, html });
  } catch (err) {
    console.error("password-reset: send failed:", err?.message || err);
    const e = new Error(
      "We couldn't send the email just now. Try again in a minute, or ask an admin for a manual reset link.",
    );
    e.statusCode = 502;
    throw e;
  }

  return publicSuccessMessage();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = {
  requestPasswordResetEmail,
  isMailConfigured,
};
