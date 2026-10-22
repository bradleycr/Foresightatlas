"use strict";

/**
 * Live Luma merge: fetch Luma events and merge with sheet events at request time.
 * Used by GET /api/database so events are always Sheet + Luma without running a sync script.
 * Luma response is cached ~10 minutes; sheet rows merge on every call so edits show immediately.
 *
 * Safe 2026 API habits:
 *   • Prefer GET /v1/calendars/events/list (legacy list-events as fallback)
 *   • Include manage + view access and luma + external platforms so partnership
 *     events added to the Foresight calendar still appear
 *   • Window list with after/before so we do not paginate years of history
 *   • Cap description hydration (list no longer returns description_md)
 */

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
/** Hard cap so one cold start cannot burn the calendar rate limit. */
const MAX_DESCRIPTION_HYDRATIONS = 25;
const DESCRIPTION_CONCURRENCY = 3;

const { isLocationUnspecified } = require("../scripts/sheet-schema.js");
const { isLocalMockMode, getMockLumaEvents } = require("./local-storage");
const {
  eventListWindow,
  isInEventWindow,
  lumaApiKey,
  lumaEventId,
  lumaGet,
  mapPool,
} = require("./luma-client");

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

/**
 * Only surface **public** Luma events on the map and programming pages.
 *
 * Luma's event `visibility` can be "public", "private", "unlisted", etc.
 * Anything that isn't explicitly public is a member-only / invite-only event
 * that we must never expose on the public atlas, so we drop it at ingestion
 * (before it can even be matched to a sheet row). When Luma omits the field
 * we err on the side of privacy and treat the event as non-public.
 */
function isPublicLumaEvent(lumaEvent) {
  return String(lumaEvent?.visibility || "").trim().toLowerCase() === "public";
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

function buildListParams(cursor, window) {
  const params = new URLSearchParams();
  if (cursor) params.set("pagination_cursor", cursor);
  params.set("pagination_limit", "50");
  params.set("sort_column", "start_at");
  params.set("sort_direction", "asc");
  if (window?.after) params.set("after", window.after);
  if (window?.before) params.set("before", window.before);
  // Partnership / mirror events listed on our calendar but managed elsewhere.
  params.append("access", "manage");
  params.append("access", "view");
  // External events hosts added onto the Foresight calendar.
  params.append("platforms", "luma");
  params.append("platforms", "external");
  return params;
}

/**
 * Page through calendar events. Tries the current plurals route first, then
 * the legacy path if the new one is unavailable (404).
 */
async function fetchLumaEventPages() {
  const window = eventListWindow();
  const paths = [
    "/v1/calendars/events/list",
    "/v1/calendar/list-events", // legacy — still works; kept as safety net
  ];

  let chosenPath = null;
  const allRaw = [];

  for (const path of paths) {
    let cursor = null;
    let pathOk = false;
    const pageEvents = [];

    while (true) {
      const params = buildListParams(cursor, window);
      // Legacy endpoint may ignore access/platforms; still fine — we just get manage/luma.
      const result = await lumaGet(`${path}?${params}`);

      if (!result.ok) {
        if (!pathOk && (result.status === 404 || result.status === 405)) {
          break; // try next path
        }
        console.error(
          `[luma-merge] Luma API error ${result.status} on ${path}: ${(result.bodyText || "").slice(0, 200)}`,
        );
        if (!pathOk) break;
        // Mid-pagination failure: keep what we have.
        break;
      }

      pathOk = true;
      chosenPath = path;
      const data = result.data || {};
      const entries = data.entries || [];
      if (entries.length === 0) break;

      for (const entry of entries) {
        // New route: flat entry. Legacy: often nested under `.event`.
        const ev = entry.event || entry;
        if (!isPublicLumaEvent(ev)) continue;
        // Preserve calendar access so guest enrich can skip view-only mirrors
        // (Luma returns 403 on guests/list for events we do not manage).
        const access = String(entry.access || ev.access || "manage").toLowerCase();
        pageEvents.push({ ...ev, _lumaAccess: access === "view" ? "view" : "manage" });
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

    if (pathOk) {
      allRaw.push(...pageEvents);
      break;
    }
  }

  if (chosenPath) {
    console.log(
      `[luma-merge] Listed ${allRaw.length} public Luma events via ${chosenPath}`,
    );
  }

  return allRaw;
}

/**
 * List responses omitted description_md (July 2026). Hydrate a small capped
 * set of upcoming events so cards have copy without burning the rate limit.
 * Prefer soonest upcoming first — the list archive is years deep, but we only
 * spend hydrate budget on what people are about to open.
 */
async function hydrateMissingDescriptions(mapped) {
  const now = Date.now();
  const need = mapped
    .filter(
      (ev) =>
        !String(ev.description || "").trim() &&
        ev._lumaApiId &&
        isInEventWindow(ev.startAt, ev.endAt),
    )
    .sort((a, b) => {
      const aT = new Date(a.startAt).getTime();
      const bT = new Date(b.startAt).getTime();
      const aUpcoming = aT >= now ? 0 : 1;
      const bUpcoming = bT >= now ? 0 : 1;
      if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
      return aT - bT;
    });
  if (need.length === 0) return;

  const batch = need.slice(0, MAX_DESCRIPTION_HYDRATIONS);
  await mapPool(batch, DESCRIPTION_CONCURRENCY, async (ev) => {
    const id = encodeURIComponent(ev._lumaApiId);
    // Current get (`event_id`), then legacy (`api_id`) if needed.
    let result = await lumaGet(`/v1/events/get?event_id=${id}`);
    if (!result.ok && (result.status === 404 || result.status === 400)) {
      result = await lumaGet(`/v1/event/get?api_id=${id}`);
    }
    if (!result.ok || !result.data) return;

    const detail = result.data.event || result.data;
    const text = String(detail.description_md || detail.description || "").trim();
    if (text) ev.description = text;
  });
}

function mapRawLumaEvent(ev) {
  const id = lumaEventId(ev);
  if (!id) return null;

  const urlLink = normalizeLumaEventUrl(ev.url);
  const externalLink = urlLink || `https://lu.ma/e/${id}`;
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
    _lumaApiId: id,
    id: `luma-${id}`,
    lumaEventId: id,
    /** @type {"manage"|"view"} */
    lumaAccess: ev._lumaAccess === "view" ? "view" : "manage",
    nodeSlug,
    title: ev.name || "Untitled Event",
    // List APIs no longer return description; hydrate fills this later when empty.
    description: String(ev.description_md || ev.description || "").trim(),
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
}

async function fetchLumaEvents() {
  if (!lumaApiKey()) {
    if (isLocalMockMode()) return getMockLumaEvents();
    return [];
  }

  const raw = await fetchLumaEventPages();
  const mapped = raw.map(mapRawLumaEvent).filter(Boolean);
  try {
    await hydrateMissingDescriptions(mapped);
  } catch (err) {
    console.warn("[luma-merge] Description hydrate skipped:", err?.message || err);
  }
  return mapped;
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
        lumaEventId: sheetEv._lumaEventId || lumaEv._lumaApiId,
        lumaAccess: lumaEv.lumaAccess || "manage",
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
      if (_lumaEventId) clean.lumaEventId = _lumaEventId;
      merged.push(clean);
    }
  }

  for (const lumaEv of lumaEvents) {
    if (!matchedLumaIds.has(lumaEv._lumaApiId)) {
      const { _lumaApiId, ...clean } = lumaEv;
      if (isLocationUnspecified(clean.location)) clean.nodeSlug = "global";
      merged.push({ ...clean, lumaEventId: lumaEv._lumaApiId });
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
  /** Used by scripts/sync-events.js so CLI sync matches live merge behavior. */
  fetchLumaEvents,
};
