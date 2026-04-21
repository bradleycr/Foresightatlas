#!/usr/bin/env node
/**
 * Sync events from two sources → public/data/events.json
 *
 *   1. Google Sheet "Events" tab  (manual entries, internal events)
 *   2. Luma API calendar           (public registration events)
 *
 * Deduplication: if a Sheet row has a `lumaEventId` matching a Luma event,
 * Luma data wins (title, description, times, location, link) so the event
 * is never shown twice. Sheet-only and Luma-only events are both included.
 *
 * Env vars (loaded from .env.local / .env):
 *   SPREADSHEET_ID           – Google Sheet ID (defaults to the Foresight sheet)
 *   GOOGLE_SHEETS_API_KEY    – read-only API key for the sheet
 *   LUMA_API_KEY             – Luma API key (Settings → Developer on your calendar)
 *   LUMA_CALENDAR_API_ID     – Luma calendar API ID (from calendar settings)
 *
 * If LUMA_API_KEY is missing, only Sheet events are synced (no error).
 * If GOOGLE_SHEETS_API_KEY is missing, only Luma events are synced.
 *
 * Output: public/data/events.json — array of NodeEvent objects.
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs").promises;
const path = require("path");

/* ── config ──────────────────────────────────────────────────────────── */

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ";
const SHEETS_API_KEY =
  process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY;
const LUMA_API_KEY = process.env.LUMA_API_KEY;
const LUMA_CALENDAR_API_ID = process.env.LUMA_CALENDAR_API_ID;
const LUMA_BASE = "https://public-api.luma.com";

const OUT_PATH = path.join(__dirname, "../public/data/events.json");

const {
  SHEET_NAMES,
  EVENTS_HEADERS,
  isLocationUnspecified,
} = require("./sheet-schema.js");

/* ── helpers ─────────────────────────────────────────────────────────── */

function parseJsonSafe(str, fallback) {
  if (str == null || String(str).trim() === "") return fallback;
  try { return JSON.parse(String(str)); } catch { return fallback; }
}

function slugify(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * Luma's `event.url` can be either a slug ("abcd1234") or full URL.
 * Normalize both shapes to a valid public event URL.
 */
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

/** Map a Luma event type string to our EventType enum. */
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
 * Keep this in sync with the server's live merge (`server/luma-merge.js`) so
 * deploy-time `events.json` and runtime API results agree.
 */
function guessNode(lumaEvent) {
  const geo = lumaEvent.geo_address_info || {};
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
    /\bsan francisco\b|\bbay area\b|\bsilicon valley\b|\boakland\b|\bberkeley\b|\bpalo alto\b/.test(full) ||
    /\bsan francisco\b|\bbay area\b|\bsf\b/.test(name) ||
    region === "california" ||
    tz === "america/los_angeles";
  if (isSf) return "sf";

  // ── Description keywords (weakest; only if nothing else matched) ────
  if (/\bberlin\b/.test(desc)) return "berlin";
  if (/\bsan francisco\b|\bbay area\b/.test(desc)) return "sf";

  return "global";
}

/* ── Google Sheet fetch ──────────────────────────────────────────────── */

async function fetchSheetEvents() {
  if (!SHEETS_API_KEY) {
    console.log("  No GOOGLE_SHEETS_API_KEY — skipping Sheet events.");
    return [];
  }

  const { google } = require("googleapis");
  const auth = new google.auth.GoogleAuth({ apiKey: SHEETS_API_KEY });
  const sheets = google.sheets({ version: "v4", auth });

  let rows;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAMES.EVENTS}'!A:N`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    rows = res.data.values || [];
  } catch (err) {
    if (err.code === 400 && err.message?.includes("Unable to parse range")) {
      console.log("  Events tab not found in spreadsheet — skipping.");
      return [];
    }
    throw err;
  }

  if (rows.length < 2) return [];

  const [headerRow, ...dataRows] = rows;
  const colIndex = {};
  EVENTS_HEADERS.forEach((h) => {
    colIndex[h] = headerRow.findIndex((c) => String(c).trim() === h);
  });

  return dataRows
    .map((row) => {
      const get = (name) => {
        const i = colIndex[name];
        return i >= 0 && row[i] != null ? String(row[i]).trim() : "";
      };
      const id = get("id");
      if (!id) return null;

      const cap = get("capacity");
      const location = get("location");
      const nodeSlugFromSheet = get("nodeSlug") || "berlin";
      const nodeSlug = isLocationUnspecified(location) ? "global" : nodeSlugFromSheet;
      return {
        id,
        nodeSlug,
        title: get("title"),
        description: get("description"),
        location,
        startAt: get("startAt"),
        endAt: get("endAt"),
        type: get("type") || "other",
        tags: parseJsonSafe(get("tags"), []),
        visibility: get("visibility") || "internal",
        capacity: cap === "" ? null : parseInt(cap, 10) || null,
        externalLink: get("externalLink") || null,
        recurrenceGroupId: get("recurrenceGroupId") || null,
        _lumaEventId: get("lumaEventId") || null,
      };
    })
    .filter(Boolean);
}

/* ── Luma API fetch ──────────────────────────────────────────────────── */

async function fetchLumaEvents() {
  if (!LUMA_API_KEY) {
    console.log("  No LUMA_API_KEY — skipping Luma events.");
    return [];
  }

  const headers = { "x-luma-api-key": LUMA_API_KEY };
  const allEvents = [];
  let cursor = null;

  // Paginate through all events
  while (true) {
    const params = new URLSearchParams();
    if (cursor) params.set("pagination_cursor", cursor);
    params.set("pagination_limit", "50");
    params.set("sort_column", "start_at");
    params.set("sort_direction", "asc");

    const url = `${LUMA_BASE}/v1/calendar/list-events?${params}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const body = await res.text();
      console.error(`  Luma API error ${res.status}: ${body}`);
      break;
    }

    const data = await res.json();
    const entries = data.entries || [];
    if (entries.length === 0) break;

    for (const entry of entries) {
      const ev = entry.event || entry;
      allEvents.push(ev);
    }

    if (!data.has_more) break;
    cursor = data.next_cursor;
  }

  console.log(`  Fetched ${allEvents.length} events from Luma.`);

  return allEvents.map((ev) => {
    const urlLink = normalizeLumaEventUrl(ev.url);
    const externalLink = urlLink || (ev.api_id ? `https://lu.ma/e/${ev.api_id}` : null);
    const location =
      ev.geo_address_info?.full_address ||
      ev.geo_address_info?.city_state ||
      ev.geo_address_info?.address ||
      ev.geo_address_info?.city ||
      ev.meeting_url ||
      "TBA";
    const geoHasSignal = Boolean(
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
      _lumaUrl: urlLink || externalLink,
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

/* ── merge + deduplicate ─────────────────────────────────────────────── */

function mergeEvents(sheetEvents, lumaEvents) {
  // Build a lookup of Luma events by their API ID
  const lumaById = new Map();
  for (const ev of lumaEvents) {
    lumaById.set(ev._lumaApiId, ev);
  }

  // Track which Luma events were matched to Sheet rows
  const matchedLumaIds = new Set();
  const merged = [];

  for (const sheetEv of sheetEvents) {
    // Only merge once per Luma event — if two sheet rows share the same lumaEventId, second is sheet-only
    const alreadyMatched = sheetEv._lumaEventId && matchedLumaIds.has(sheetEv._lumaEventId);
    if (sheetEv._lumaEventId && lumaById.has(sheetEv._lumaEventId) && !alreadyMatched) {
      // Sheet row links to a Luma event — Luma data wins for rich fields
      const lumaEv = lumaById.get(sheetEv._lumaEventId);
      matchedLumaIds.add(sheetEv._lumaEventId);
      const location = lumaEv.location;
      let nodeSlug = sheetEv.nodeSlug || lumaEv.nodeSlug;
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
      // Sheet-only event
      const { _lumaEventId, ...clean } = sheetEv;
      merged.push(clean);
    }
  }

  // Add Luma-only events (not matched to any Sheet row)
  for (const lumaEv of lumaEvents) {
    if (!matchedLumaIds.has(lumaEv._lumaApiId)) {
      const { _lumaApiId, _lumaUrl, ...clean } = lumaEv;
      if (isLocationUnspecified(clean.location)) clean.nodeSlug = "global";
      merged.push(clean);
    }
  }

  // Final pass: any event with unspecified location belongs on Global
  for (const ev of merged) {
    if (isLocationUnspecified(ev.location)) ev.nodeSlug = "global";
  }

  // Sort by start time
  merged.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return merged;
}

/* ── main ────────────────────────────────────────────────────────────── */

async function main() {
  console.log("Syncing events…");

  const [sheetEvents, lumaEvents] = await Promise.all([
    fetchSheetEvents(),
    fetchLumaEvents(),
  ]);

  console.log(`  Sheet: ${sheetEvents.length} events, Luma: ${lumaEvents.length} events.`);

  const events = mergeEvents(sheetEvents, lumaEvents);

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(events, null, 2), "utf8");

  console.log(`  Wrote ${OUT_PATH}: ${events.length} merged events.`);
}

main().catch((err) => {
  console.error("Event sync failed (events.json unchanged):", err.message);
  process.exit(0); // Don't break the build
});
