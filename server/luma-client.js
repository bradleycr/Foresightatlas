"use strict";

/**
 * Small shared helpers for Luma Public API calls.
 *
 * Safe defaults for the atlas:
 *   • Prefer current plurals routes, fall back to legacy paths when needed
 *   • Honor 429 Retry-After instead of hammering the calendar key (200/min)
 *   • List window keeps prior-year history on programming pages; engagement
 *     window stays short so guest RSVP sync / description hydrate stay cheap
 */

const LUMA_BASE = "https://public-api.luma.com";

/**
 * Guest RSVP enrichment + description hydrate — recent activity only.
 * Must stay narrow: past events do not need live guest pulls.
 */
const EVENT_WINDOW_PAST_MS = 7 * 24 * 60 * 60 * 1000;
const EVENT_WINDOW_FUTURE_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * How many prior calendar years of Luma history to list for programming pages.
 * In 2026 → from 2025-01-01; in 2027 → from 2026-01-01 (so 2026 stays browsable).
 */
const EVENT_ARCHIVE_PRIOR_YEARS = 1;

const MAX_RETRIES_ON_429 = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lumaApiKey() {
  return String(process.env.LUMA_API_KEY || "").trim();
}

function lumaHeaders(apiKey = lumaApiKey()) {
  return { "x-luma-api-key": apiKey };
}

/**
 * ISO bounds for list-events `after` / `before`.
 * Archive starts Jan 1 of (currentYear − {@link EVENT_ARCHIVE_PRIOR_YEARS})
 * so past months stay on the programming calendar; future bound matches the
 * engagement horizon.
 */
function eventListWindow(now = Date.now()) {
  const year = new Date(now).getUTCFullYear();
  const archiveStart = Date.UTC(year - EVENT_ARCHIVE_PRIOR_YEARS, 0, 1);
  return {
    after: new Date(archiveStart).toISOString(),
    before: new Date(now + EVENT_WINDOW_FUTURE_MS).toISOString(),
  };
}

/** True when an event falls in the short engagement window (guests / hydrate). */
function isInEventWindow(startAt, endAt, now = Date.now()) {
  const weekAgo = now - EVENT_WINDOW_PAST_MS;
  const sixMonthsAhead = now + EVENT_WINDOW_FUTURE_MS;
  const end = new Date(endAt).getTime();
  const start = new Date(startAt).getTime();
  if (!Number.isFinite(end) || !Number.isFinite(start)) return true;
  return end >= weekAgo && start <= sixMonthsAhead;
}

/**
 * Prefer current `id`; keep `api_id` for legacy list responses.
 * @param {object} ev
 */
function lumaEventId(ev) {
  const id = String(ev?.id || ev?.api_id || "").trim();
  return id || null;
}

/**
 * GET JSON from Luma with light 429 backoff. Does not throw on non-OK —
 * returns `{ ok, status, data, bodyText }` so callers can fall back.
 *
 * @param {string} pathAndQuery absolute path starting with /v1/…
 * @param {{ apiKey?: string, signal?: AbortSignal }} [opts]
 */
async function lumaGet(pathAndQuery, opts = {}) {
  const apiKey = opts.apiKey || lumaApiKey();
  if (!apiKey) {
    return { ok: false, status: 0, data: null, bodyText: "missing LUMA_API_KEY" };
  }

  const url = pathAndQuery.startsWith("http")
    ? pathAndQuery
    : `${LUMA_BASE}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;

  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      headers: lumaHeaders(apiKey),
      signal: opts.signal,
    });

    if (res.status === 429 && attempt < MAX_RETRIES_ON_429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 60;
      const waitMs = Math.min(Math.max(retryAfter, 1), 90) * 1000;
      attempt += 1;
      console.warn(
        `[luma] 429 on ${pathAndQuery.split("?")[0]} — waiting ${waitMs}ms (attempt ${attempt})`,
      );
      await sleep(waitMs);
      continue;
    }

    const bodyText = await res.text();
    let data = null;
    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, bodyText };
  }
}

/**
 * Run async work over items with a fixed concurrency cap (rate-limit friendly).
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
async function mapPool(items, concurrency, worker) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Math.min(concurrency, list.length || 1));
  const results = new Array(list.length);
  let next = 0;

  async function run() {
    while (next < list.length) {
      const i = next;
      next += 1;
      results[i] = await worker(list[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, () => run()));
  return results;
}

module.exports = {
  LUMA_BASE,
  EVENT_WINDOW_PAST_MS,
  EVENT_WINDOW_FUTURE_MS,
  EVENT_ARCHIVE_PRIOR_YEARS,
  eventListWindow,
  isInEventWindow,
  lumaApiKey,
  lumaEventId,
  lumaGet,
  lumaHeaders,
  mapPool,
};
