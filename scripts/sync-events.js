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
 *   SPREADSHEET_ID           – Google Sheet ID (required; private)
 *   GOOGLE_SHEETS_API_KEY    – read-only API key for the sheet
 *   LUMA_API_KEY             – Luma API key (Settings → Developer on your calendar)
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

const { getSpreadsheetId } = require("./sheet-schema");
const SPREADSHEET_ID = getSpreadsheetId();
const SHEETS_API_KEY =
  process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY;
const LUMA_API_KEY = process.env.LUMA_API_KEY;

const OUT_PATH = path.join(__dirname, "../public/data/events.json");

const {
  SHEET_NAMES,
  EVENTS_HEADERS,
  isLocationUnspecified,
} = require("./sheet-schema.js");
const {
  applyBerlinSecureWorkshopSheetOverrides,
} = require("../server/event-corrections");
const { fetchLumaEvents } = require("../server/luma-merge");

/* ── helpers ─────────────────────────────────────────────────────────── */

function parseJsonSafe(str, fallback) {
  if (str == null || String(str).trim() === "") return fallback;
  try { return JSON.parse(String(str)); } catch { return fallback; }
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
      const { _lumaApiId, ...clean } = lumaEv;
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

  if (!LUMA_API_KEY) {
    console.log("  No LUMA_API_KEY — skipping Luma events.");
  }

  const [rawSheetEvents, lumaEvents] = await Promise.all([
    fetchSheetEvents(),
    LUMA_API_KEY ? fetchLumaEvents() : Promise.resolve([]),
  ]);
  const sheetEvents = applyBerlinSecureWorkshopSheetOverrides(rawSheetEvents);

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
