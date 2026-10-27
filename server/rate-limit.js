"use strict";

/**
 * Tiny in-memory rate limiter for serverless / Express.
 *
 * Good enough to blunt casual abuse on magic-link requests. Buckets reset
 * when the process sleeps (Vercel) — that's fine; the sheet is the real
 * source of truth and tokens themselves expire.
 */

/** @type {Map<string, number[]>} */
const buckets = new Map();

/**
 * @param {string} key
 * @param {{ limit: number, windowMs: number, dryRun?: boolean }} opts
 * @returns {{ ok: true } | { ok: false, retryAfterSec: number }}
 */
function rateLimit(key, { limit, windowMs, dryRun = false }) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const prev = buckets.get(key) || [];
  const recent = prev.filter((ts) => ts > cutoff);
  if (recent.length >= limit) {
    const oldest = recent[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, recent);
    return { ok: false, retryAfterSec };
  }
  if (!dryRun) {
    recent.push(now);
    buckets.set(key, recent);
  }
  return { ok: true };
}

module.exports = { rateLimit };
