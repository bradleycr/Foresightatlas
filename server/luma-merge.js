"use strict";

/**
 * Live Luma merge: fetch Luma events and merge with sheet events at request time.
 * Used by GET /api/database so events are always Sheet + Luma without running a sync script.
 * Luma response is cached ~10 minutes; sheet rows merge on every call so edits show immediately.
 */

const LUMA_BASE = "https://public-api.luma.com";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const { isLocationUnspecified } = require("../scripts/sheet-schema.js");
const { isLocalMockMode, getMockLumaEvents } = require("./local-storage");

/** Cache Luma fetch only; sheet events are always merged fresh (avoids stale sheet rows). */
let cache = null; // { lumaEvents: Array, expiresAt: number }

function normalizeLumaEventUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^(lu\.ma|luma\.com)\//i.test(raw)) return `https://${raw}`;
  return `https://lu.ma/${raw.replace(/^\/+/, "")}`;
}

function isUrlLikeLocation(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return false;
  if (/^https?:\/\//.test(s)) return true;
  if (s.includes("zoom.us/") || s.includes("meet.google.com/")) return true;
  return false;
}

function mapLumaType(lumaEvent) {
  const name = (lumaEvent.name || "").toLowerCase();
  if (name.includes("coworking")) return "coworking";
  if (name.includes("workshop")) return "workshop";
  if (name.includes("demo")) return "demo";
  if (name.includes("open house")) return "open-house";
  if (name.includes("launch")) return "launch";
  if (name.includes("conference")) return "conference";
  if (name.includes("social")) return "social";
  return "other";
}

/**
 * Decide which Foresight node a Luma event belongs to.
 *
 * We layer signals from strongest to weakest so regional events consistently
 * land on the right page:
 *
 *   1. Structured geo_address_info (city, region, country) — most reliable
 *   2. Event timezone (IANA id) — reliable second signal for virtual-with-region
 *   3. Full address / name keywords — handles "SF Node Launch", "Berlin Salon"
 *   4. Description keywords — last resort (weakest)
 *
 * Anything that doesn't match a physical node is treated as "global", which is
 * also the bucket for fully virtual events. Callers still force "global" when
 * the resolved location is TBA / unspecified (see isLocationUnspecified).
 */
function guessNode(lumaEvent) {
  const geo = lumaEvent.geo_address_json || lumaEvent.geo_address_info || {};
  const city = String(geo.city || "").toLowerCase().trim();
  const region = String(geo.region || "").toLowerCase().trim();
  const country = String(geo.country || "").toLowerCase().trim();
  const countryCode = String(geo.country_code || "").toLowerCase().trim();
  const full = String(geo.full_address || geo.city_state || geo.address || "").toLowerCase();
  const name = String(lumaEvent.name || "").toLowerCase();
  const desc = String(lumaEvent.description || "").toLowerCase();
  const tz = String(lumaEvent.timezone || "").toLowerCase();

  // ── Berlin / Germany signals ────────────────────────────────────────
  const isBerlin =
    city === "berlin" ||
    /\bberlin\b/.test(full) ||
    /\bberlin\b/.test(name) ||
    country === "germany" ||
    country === "deutschland" ||
    countryCode === "de" ||
    tz === "europe/berlin";
  if (isBerlin) return "berlin";

  // ── San Francisco / Bay Area signals ────────────────────────────────
  const bayAreaCities = new Set([
    "san francisco", "oakland", "berkeley", "palo alto", "mountain view",
    "menlo park", "san jose", "sunnyvale", "san mateo", "redwood city",
    "emeryville", "daly city", "south san francisco", "fremont", "cupertino",
    "santa clara", "hayward", "richmond", "alameda",
  ]);
  const isSf =
    bayAreaCities.has(city) ||
    /\bsan frans?cisco\b|\bbay ar(?:ea|e)\b|\bsilicon valley\b|\boakland\b|\bberkeley\b|\bpalo alto\b|\bthe fold\b/.test(full) ||
    /\bsan frans?cisco\b|\bbay ar(?:ea|e)\b|\bsf\b|\bthe fold\b/.test(name) ||
    region === "california" ||
    tz === "america/los_angeles";
  if (isSf) return "sf";

  // ── Description keywords (weakest; only if nothing else matched) ────
  if (/\bberlin\b/.test(desc)) return "berlin";
  if (/\bsan frans?cisco\b|\bbay ar(?:ea|e)\b|\bthe fold\b/.test(desc)) return "sf";

  return "global";
}

async function fetchLumaEvents() {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) {
    if (isLocalMockMode()) return getMockLumaEvents();
    return [];
  }

  const headers = { "x-luma-api-key": apiKey };
  const allEvents = [];
  let cursor = null;

  while (true) {
    const params = new URLSearchParams();
    if (cursor) params.set("pagination_cursor", cursor);
    params.set("pagination_limit", "50");
    params.set("sort_column", "start_at");
    params.set("sort_direction", "asc");

    const res = await fetch(`${LUMA_BASE}/v1/calendar/list-events?${params}`, { headers });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[luma-merge] Luma API error ${res.status}: ${body}`);
      break;
    }

    const data = await res.json().catch(() => ({}));
    const entries = data.entries || [];
    if (entries.length === 0) break;

    for (const entry of entries) {
      const ev = entry.event || entry;
      allEvents.push(ev);
    }

    if (!data.has_more) break;
    const next = data.next_cursor;
    if (next == null || next === "") {
      console.warn(
        "[luma-merge] Luma API returned has_more without next_cursor; stopping pagination",
      );
      break;
    }
    cursor = next;
  }

  return allEvents.map((ev) => {
    const urlLink = normalizeLumaEventUrl(ev.url);
    const externalLink = urlLink || (ev.api_id ? `https://lu.ma/e/${ev.api_id}` : null);
    const location =
      ev.geo_address_json?.full_address ||
      ev.geo_address_json?.city_state ||
      ev.geo_address_json?.address ||
      ev.geo_address_json?.city ||
      ev.geo_address_info?.full_address ||
      ev.geo_address_info?.city_state ||
      ev.geo_address_info?.address ||
      ev.geo_address_info?.city ||
      ev.meeting_url ||
      "TBA";
    const geoHasSignal = Boolean(
      ev.geo_address_json?.full_address ||
      ev.geo_address_json?.city_state ||
      ev.geo_address_json?.address ||
      ev.geo_address_json?.city ||
      ev.geo_address_json?.region ||
      ev.geo_address_json?.country ||
      ev.geo_address_json?.country_code ||
      ev.geo_address_info?.full_address ||
      ev.geo_address_info?.city_state ||
      ev.geo_address_info?.address ||
      ev.geo_address_info?.city ||
      ev.geo_address_info?.region ||
      ev.geo_address_info?.country ||
      ev.geo_address_info?.country_code,
    );
    const nodeSlug =
      isLocationUnspecified(location) || (isUrlLikeLocation(location) && !geoHasSignal)
        ? "global"
        : guessNode(ev);
    const coverUrl = (ev.cover_url && String(ev.cover_url).trim()) || null;
    return {
      _lumaApiId: ev.api_id,
      id: `luma-${ev.api_id}`,
      nodeSlug,
      title: ev.name || "Untitled Event",
      description: (ev.description_md || ev.description || "").trim(),
      location,
      startAt: ev.start_at,
      endAt: ev.end_at,
      type: mapLumaType(ev),
      tags: [],
      visibility: ev.visibility === "public" ? "public" : "internal",
      capacity: ev.max_capacity || null,
      externalLink,
      coverImageUrl: coverUrl,
      recurrenceGroupId: ev.recurrence_id || null,
    };
  });
}

function mergeEvents(sheetEvents, lumaEvents) {
  const lumaById = new Map();
  for (const ev of lumaEvents) lumaById.set(ev._lumaApiId, ev);

  const matchedLumaIds = new Set();
  const merged = [];

  for (const sheetEv of sheetEvents) {
    // Only merge when Sheet links to Luma and we haven't already used this Luma event
    // (prevents duplicates if two sheet rows share the same lumaEventId)
    const alreadyMatched = sheetEv._lumaEventId && matchedLumaIds.has(sheetEv._lumaEventId);
    if (sheetEv._lumaEventId && lumaById.has(sheetEv._lumaEventId) && !alreadyMatched) {
      const lumaEv = lumaById.get(sheetEv._lumaEventId);
      matchedLumaIds.add(sheetEv._lumaEventId);
      const location = lumaEv.location;
      // Sheet wins when it asserts a node; otherwise prefer Luma's geo-based guess.
      // Leave "global" as the last-resort default so the event still shows somewhere.
      let nodeSlug = sheetEv.nodeSlug || lumaEv.nodeSlug || "global";
      if (isLocationUnspecified(location)) nodeSlug = "global";
      merged.push({
        id: sheetEv.id,
        nodeSlug,
        title: lumaEv.title,
        description: lumaEv.description || sheetEv.description,
        location,
        startAt: lumaEv.startAt,
        endAt: lumaEv.endAt,
        type: sheetEv.type !== "other" ? sheetEv.type : lumaEv.type,
        tags: sheetEv.tags?.length ? sheetEv.tags : lumaEv.tags,
        visibility: lumaEv.visibility,
        capacity: lumaEv.capacity ?? sheetEv.capacity,
        externalLink: lumaEv.externalLink || sheetEv.externalLink,
        coverImageUrl: lumaEv.coverImageUrl ?? sheetEv.coverImageUrl ?? null,
        recurrenceGroupId: lumaEv.recurrenceGroupId || sheetEv.recurrenceGroupId,
      });
    } else {
      const { _lumaEventId, ...clean } = sheetEv;
      // Sheet row without a Luma link: never leave nodeSlug null, default to global.
      if (!clean.nodeSlug) clean.nodeSlug = "global";
      merged.push(clean);
    }
  }

  for (const lumaEv of lumaEvents) {
    if (!matchedLumaIds.has(lumaEv._lumaApiId)) {
      const { _lumaApiId, ...clean } = lumaEv;
      if (isLocationUnspecified(clean.location)) clean.nodeSlug = "global";
      merged.push(clean);
    }
  }

  for (const ev of merged) {
    if (isLocationUnspecified(ev.location)) ev.nodeSlug = "global";
  }

  merged.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  return merged;
}

/**
 * Merge sheet events with Luma events. Uses a short in-memory cache so we don't
 * hit the Luma API on every request. When cache is stale or missing, fetches Luma
 * and merges again.
 *
 * @param {Array} sheetEvents - Events from the Google Sheet (with _lumaEventId when linked)
 * @returns {Promise<Array>} Merged events (Sheet + Luma, deduplicated)
 */
async function mergeSheetEventsWithLuma(sheetEvents) {
  const now = Date.now();
  let lumaEvents = [];
  if (cache && cache.expiresAt > now && Array.isArray(cache.lumaEvents)) {
    lumaEvents = cache.lumaEvents;
  } else {
    lumaEvents = await fetchLumaEvents();
    cache = { lumaEvents, expiresAt: now + CACHE_TTL_MS };
  }
  return mergeEvents(Array.isArray(sheetEvents) ? sheetEvents : [], lumaEvents);
}

module.exports = {
  mergeSheetEventsWithLuma,
};
