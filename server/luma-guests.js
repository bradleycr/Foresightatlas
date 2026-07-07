"use strict";

/**
 * Display-only Luma guest → Atlas RSVP merge.
 *
 * Fetches approved Luma registrants for linked events, matches them to directory
 * members by email, and merges into the RSVP list returned by the API. Atlas
 * sheet RSVPs always win when the same person already has a row for that event.
 */

const LUMA_BASE = "https://public-api.luma.com";
const CACHE_TTL_MS = 10 * 60 * 1000;
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const { isLocalMockMode, getMockLumaGuests } = require("./local-storage");

/** @type {Map<string, { guests: object[]; expiresAt: number }>} */
const guestCache = new Map();

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function extractEmailsFromContact(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const parts = raw.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
  const emails = [];
  for (const part of parts) {
    const email = normalizeEmail(part);
    if (EMAIL_RE.test(email)) emails.push(email);
  }
  return emails;
}

/**
 * Map normalized email → { personId, fullName } for directory matching.
 * Uses roster email, calendar email, and email-like preferred contact values.
 */
function buildEmailToPersonMap(records) {
  const map = new Map();
  for (const record of records || []) {
    const person = record?.person;
    if (!person?.id) continue;
    const candidateEmails = [
      person.email,
      person.calendarEmail,
      ...extractEmailsFromContact(person.contactUrlOrHandle),
    ];
    for (const email of candidateEmails) {
      const normalized = normalizeEmail(email);
      if (!normalized || !EMAIL_RE.test(normalized)) continue;
      if (!map.has(normalized)) {
        map.set(normalized, { personId: person.id, fullName: person.fullName || "" });
      }
    }
  }
  return map;
}

/** Resolve the Luma event id used by the guests API from an Atlas event row. */
function resolveLumaEventId(event) {
  if (!event) return null;
  if (event.lumaEventId) return String(event.lumaEventId).trim() || null;
  const id = String(event.id || "");
  if (id.startsWith("luma-")) return id.slice("luma-".length) || null;
  return null;
}

function guestEmail(guest) {
  return normalizeEmail(
    guest?.email || guest?.user_email || guest?.guest_email || guest?.user?.email || "",
  );
}

function guestRegisteredAt(guest) {
  const raw =
    guest?.registered_at ||
    guest?.created_at ||
    guest?.approved_at ||
    guest?.updated_at ||
    null;
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

async function fetchLumaGuestsForEvent(lumaEventId) {
  const key = String(lumaEventId || "").trim();
  if (!key) return [];

  const now = Date.now();
  const cached = guestCache.get(key);
  if (cached && cached.expiresAt > now) return cached.guests;

  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) {
    const guests = isLocalMockMode() ? getMockLumaGuests(key) : [];
    guestCache.set(key, { guests, expiresAt: now + CACHE_TTL_MS });
    return guests;
  }

  const headers = { "x-luma-api-key": apiKey };
  const guests = [];
  let cursor = null;

  while (true) {
    const params = new URLSearchParams();
    params.set("event_id", key);
    params.set("approval_status", "approved");
    params.set("pagination_limit", "50");
    if (cursor) params.set("pagination_cursor", cursor);

    let res = await fetch(`${LUMA_BASE}/v1/events/guests/list?${params}`, { headers });
    if (!res.ok && res.status === 404) {
      // Legacy path for older calendar API keys.
      const legacyParams = new URLSearchParams();
      legacyParams.set("event_api_id", key);
      legacyParams.set("approval_status", "approved");
      legacyParams.set("pagination_limit", "50");
      if (cursor) legacyParams.set("pagination_cursor", cursor);
      res = await fetch(`${LUMA_BASE}/v1/event/get-guests?${legacyParams}`, { headers });
    }

    if (!res.ok) {
      const body = await res.text();
      console.warn(`[luma-guests] Luma guests API ${res.status} for ${key}: ${body.slice(0, 200)}`);
      break;
    }

    const data = await res.json().catch(() => ({}));
    const entries = data.entries || data.guests || [];
    if (entries.length === 0) break;

    for (const entry of entries) {
      const guest = entry.guest || entry;
      guests.push(guest);
    }

    if (!data.has_more) break;
    const next = data.next_cursor;
    if (next == null || next === "") break;
    cursor = next;
  }

  guestCache.set(key, { guests, expiresAt: now + CACHE_TTL_MS });
  return guests;
}

function isRelevantEventWindow(event, now = Date.now()) {
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const sixMonthsAhead = now + 180 * 24 * 60 * 60 * 1000;
  const end = new Date(event.endAt).getTime();
  const start = new Date(event.startAt).getTime();
  if (!Number.isFinite(end) || !Number.isFinite(start)) return true;
  return end >= weekAgo && start <= sixMonthsAhead;
}

function indexAtlasRsvps(sheetRsvps) {
  const byKey = new Map();
  for (const r of sheetRsvps || []) {
    if (!r?.eventId || !r?.personId) continue;
    byKey.set(`${r.eventId}\t${r.personId}`, r);
  }
  return byKey;
}

/**
 * Merge Luma-approved guests (directory members only) into sheet RSVPs.
 *
 * @param {Array} sheetRsvps - Latest Atlas RSVPs from the sheet
 * @param {Array} events - Merged programming events (with optional lumaEventId)
 * @param {Array} records - RealData records ({ person, auth }) for email matching
 */
async function enrichRsvpsWithLumaGuests(sheetRsvps, events, records) {
  const atlasRsvps = Array.isArray(sheetRsvps) ? [...sheetRsvps] : [];
  const atlasIndex = indexAtlasRsvps(atlasRsvps);
  const emailToPerson = buildEmailToPersonMap(records);

  if (!process.env.LUMA_API_KEY && !isLocalMockMode()) {
    return atlasRsvps;
  }

  const lumaEvents = (events || []).filter(
    (ev) => resolveLumaEventId(ev) && isRelevantEventWindow(ev),
  );

  const synthetic = [];
  await Promise.all(
    lumaEvents.map(async (event) => {
      const lumaEventId = resolveLumaEventId(event);
      if (!lumaEventId) return;
      let guests;
      try {
        guests = await fetchLumaGuestsForEvent(lumaEventId);
      } catch (err) {
        console.warn(
          `[luma-guests] Failed to load guests for ${lumaEventId}:`,
          err?.message || err,
        );
        return;
      }

      for (const guest of guests) {
        const email = guestEmail(guest);
        if (!email) continue;
        const match = emailToPerson.get(email);
        if (!match) continue;

        const key = `${event.id}\t${match.personId}`;
        if (atlasIndex.has(key)) continue;

        const registeredAt = guestRegisteredAt(guest);
        synthetic.push({
          eventId: event.id,
          eventTitle: event.title || "",
          personId: match.personId,
          fullName: match.fullName,
          status: "going",
          createdAt: registeredAt,
          updatedAt: registeredAt,
        });
        atlasIndex.set(key, synthetic[synthetic.length - 1]);
      }
    }),
  );

  if (synthetic.length === 0) return atlasRsvps;
  return [...atlasRsvps, ...synthetic];
}

module.exports = {
  buildEmailToPersonMap,
  enrichRsvpsWithLumaGuests,
  resolveLumaEventId,
};
