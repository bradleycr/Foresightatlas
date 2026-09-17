"use strict";

/**
 * Display-only Luma guest → Atlas RSVP merge.
 *
 * Fetches approved Luma registrants for linked events, matches them to directory
 * members by email, and merges into the RSVP list returned by the API.
 *
 * Precedence: **Luma approved guests supersede Atlas sheet rows** for the same
 * person × event. That keeps one "going" status (one nanowheel), surfaces Luma
 * registration in the app, and avoids double-counting when someone also RSVP'd
 * on Atlas. Atlas RSVPs never write back to Luma.
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

/**
 * Merge Luma-approved guests (directory members only) into sheet RSVPs.
 * Luma `going` replaces any Atlas row for the same person × event so nanowheels
 * and UI stay single-source.
 *
 * @param {Array} sheetRsvps - Latest Atlas RSVPs from the sheet
 * @param {Array} events - Merged programming events (with optional lumaEventId)
 * @param {Array} records - RealData records ({ person, auth }) for email matching
 */
async function enrichRsvpsWithLumaGuests(sheetRsvps, events, records) {
  const atlasRsvps = Array.isArray(sheetRsvps) ? sheetRsvps : [];
  const emailToPerson = buildEmailToPersonMap(records);

  const taggedAtlas = atlasRsvps
    .filter((r) => r?.eventId && r?.personId)
    .map((r) => ({
      ...r,
      source: r.source === "luma" ? "luma" : "atlas",
    }));

  if (!process.env.LUMA_API_KEY && !isLocalMockMode()) {
    return taggedAtlas;
  }

  const lumaEvents = (events || []).filter(
    (ev) => resolveLumaEventId(ev) && isRelevantEventWindow(ev),
  );

  /** @type {Map<string, object>} person×event keys overridden by Luma */
  const lumaByKey = new Map();

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
        const registeredAt = guestRegisteredAt(guest);
        lumaByKey.set(key, {
          eventId: event.id,
          eventTitle: event.title || "",
          personId: match.personId,
          fullName: match.fullName,
          status: "going",
          createdAt: registeredAt,
          updatedAt: registeredAt,
          source: "luma",
        });
      }
    }),
  );

  if (lumaByKey.size === 0) return taggedAtlas;

  // Drop Atlas rows that Luma now owns — one going status per person × event.
  const withoutSuperseded = taggedAtlas.filter(
    (r) => !lumaByKey.has(`${r.eventId}\t${r.personId}`),
  );

  return [...withoutSuperseded, ...lumaByKey.values()];
}

module.exports = {
  buildEmailToPersonMap,
  enrichRsvpsWithLumaGuests,
  resolveLumaEventId,
};
