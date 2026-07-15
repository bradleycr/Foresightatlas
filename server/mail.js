/**
 * Lightweight outbound mail for Atlas auth (password reset / claim).
 *
 * Supports either:
 *   1. Resend HTTP API (RESEND_API_KEY) — zero extra deps
 *   2. SMTP via nodemailer (SMTP_HOST + SMTP_USER + SMTP_PASS) — Google Workspace / Gmail app password
 *
 * If neither is configured, callers get a clear configuration error.
 */

"use strict";

function mailFrom() {
  return (
    String(process.env.MAIL_FROM || "").trim() ||
    "The Foresight Atlas <noreply@foresight.org>"
  );
}

function isMailConfigured() {
  if (String(process.env.RESEND_API_KEY || "").trim()) return true;
  if (String(process.env.SMTP_HOST || "").trim() && String(process.env.SMTP_USER || "").trim()) {
    return true;
  }
  return false;
}

async function sendViaResend({ to, subject, text, html }) {
  const key = String(process.env.RESEND_API_KEY || "").trim();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: [to],
      subject,
      text,
      html: html || undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend failed (${res.status}): ${body.slice(0, 240)}`);
  }
}

async function sendViaSmtp({ to, subject, text, html }) {
  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch {
    throw new Error(
      "SMTP is configured but nodemailer is not installed. Run: pnpm add nodemailer",
    );
  }

  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "").trim();
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });

  await transporter.sendMail({
    from: mailFrom(),
    to,
    subject,
    text,
    html: html || undefined,
  });
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 */
async function sendMail(opts) {
  const to = String(opts.to || "").trim();
  if (!to || !to.includes("@")) throw new Error("Invalid recipient email");

  if (String(process.env.RESEND_API_KEY || "").trim()) {
    return sendViaResend(opts);
  }
  if (String(process.env.SMTP_HOST || "").trim()) {
    return sendViaSmtp(opts);
  }
  throw new Error(
    "Email is not configured. Set RESEND_API_KEY, or SMTP_HOST + SMTP_USER + SMTP_PASS (e.g. Gmail app password).",
  );
}

module.exports = {
  isMailConfigured,
  sendMail,
  mailFrom,
};
