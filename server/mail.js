"use strict";

/**
 * Outbound mail via Resend (same pattern as foresight-matchmaker).
 *
 * Env:
 *   RESEND_API_KEY   — required to send
 *   SMTP_FROM        — e.g. "Foresight Atlas <noreply@foresight.org>"
 *                      (any address on a Resend-verified domain)
 *   SMTP_REPLY_TO    — optional; where replies should land
 *   AUTH_REVEAL_LINKS — "true" to show links on-screen when mail isn't sent
 *                      (local testing / first DNS deploy)
 */

const RESEND_API = "https://api.resend.com/emails";
const DEFAULT_FROM = "Foresight Atlas <noreply@foresight.org>";
const SEND_TIMEOUT_MS = 8_000;
const RETRY_WAIT_MS = 400;

function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function revealLinksAllowed() {
  if (process.env.AUTH_REVEAL_LINKS === "true") return true;
  if (mailConfigured()) return false;
  if (process.env.AUTH_REVEAL_LINKS === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/** @returns {"email" | "on_screen" | "server_log"} */
function magicLinkMode() {
  if (mailConfigured()) return "email";
  if (revealLinksAllowed()) return "on_screen";
  return "server_log";
}

function fromAddress() {
  return process.env.SMTP_FROM?.trim() || DEFAULT_FROM;
}

function replyToAddress() {
  return process.env.SMTP_REPLY_TO?.trim() || undefined;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string, idempotencyKey?: string }} opts
 * @returns {Promise<{ sent: true } | { sent: false, reason: "no_smtp" | "smtp_error" | "quota" }>}
 */
async function sendMail(opts) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.info("[mail] RESEND_API_KEY unset; would send:", {
      to: opts.to,
      subject: opts.subject,
    });
    return { sent: false, reason: "no_smtp" };
  }

  const payload = JSON.stringify({
    from: fromAddress(),
    to: [opts.to],
    reply_to: replyToAddress(),
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await fetch(RESEND_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "User-Agent": "foresight-atlas/mail",
          ...(opts.idempotencyKey
            ? { "Idempotency-Key": opts.idempotencyKey }
            : {}),
        },
        body: payload,
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (res.ok) return { sent: true };
      const detail = await res.text().catch(() => "");
      console.error("[mail] Resend rejected:", res.status, detail.slice(0, 500));
      if (res.status === 429) return { sent: false, reason: "quota" };
      if (res.status >= 500 && attempt < 2) {
        await sleep(RETRY_WAIT_MS);
        continue;
      }
      return { sent: false, reason: "smtp_error" };
    } catch (error) {
      console.error("[mail] Resend send failed:", error);
      if (attempt < 2) {
        await sleep(RETRY_WAIT_MS);
        continue;
      }
      return { sent: false, reason: "smtp_error" };
    }
  }
  return { sent: false, reason: "smtp_error" };
}

/**
 * @param {"claim" | "reset"} kind
 * @param {string} link
 * @param {string} [fullName]
 */
function renderAccessEmail(kind, link, fullName) {
  const name = String(fullName || "").trim() || "there";
  if (kind === "reset") {
    return {
      subject: "Reset your Foresight Atlas password",
      text: [
        `Hi ${name},`,
        "",
        "Use this one-time link to set a new password for The Foresight Atlas:",
        link,
        "",
        "Valid for 24 hours. If you did not request this, you can ignore it.",
        "",
        "— Foresight Atlas",
      ].join("\n"),
      html: `<p>Hi ${escapeHtml(name)},</p>
<p>Use this one-time link to set a new password for <strong>The Foresight Atlas</strong>:</p>
<p><a href="${escapeAttr(link)}">${escapeHtml(link)}</a></p>
<p style="color:#666;font-size:14px">Valid for 24 hours. If you did not request this, you can ignore it.</p>`,
    };
  }
  return {
    subject: "Your Foresight Atlas claim link",
    text: [
      `Hi ${name},`,
      "",
      "You're on The Foresight Atlas. Use this one-time link to set your password:",
      link,
      "",
      "If you did not request this, you can ignore it.",
      "",
      "— Foresight Atlas",
    ].join("\n"),
    html: `<p>Hi ${escapeHtml(name)},</p>
<p>You're on <strong>The Foresight Atlas</strong>. Use this one-time link to set your password:</p>
<p><a href="${escapeAttr(link)}">${escapeHtml(link)}</a></p>
<p style="color:#666;font-size:14px">If you did not request this, you can ignore it.</p>`,
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

/**
 * @param {string} email
 * @param {string} link
 * @param {"claim" | "reset"} kind
 * @param {string} [fullName]
 */
async function sendAccessMagicLink(email, link, kind, fullName) {
  if (!mailConfigured()) {
    console.info(`[auth] magic link (${kind}) for ${email}: ${link}`);
    return { sent: false, reason: "no_smtp" };
  }
  const { subject, text, html } = renderAccessEmail(kind, link, fullName);
  const result = await sendMail({
    to: email,
    subject,
    text,
    html,
    idempotencyKey: `atlas-${kind}-${email}-${Date.now()}`,
  });
  if (!result.sent) {
    console.info(`[auth] magic link (${kind}) for ${email} (send failed): ${link}`);
  }
  return result;
}

module.exports = {
  mailConfigured,
  revealLinksAllowed,
  magicLinkMode,
  sendMail,
  sendAccessMagicLink,
  renderAccessEmail,
};
