/**
 * Client-side RSVP persistence backed by localStorage.
 *
 * Shape: { [eventId]: { [personId]: RSVPRecord } }
 *
 * Every write is a full JSON serialization — fine for hundreds of
 * records; swap with server-backed /api/rsvp when ready.
 * The public API mirrors what a REST endpoint would expose so callers
 * won't need to change during migration.
 */

import { RSVPRecord, RSVPStatus, RSVPSummary } from "../types/events";

const STORAGE_KEY = "foresightmap_rsvps";

type Store = Record<string, Record<string, RSVPRecord>>;

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(store: Store): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/* ── writes ─────────────────────────────────────────────────────────── */

/** Upsert — idempotent by design (mirrors a PATCH endpoint). */
export function setRSVP(
  eventId: string,
  personId: string,
  status: RSVPStatus,
): RSVPRecord {
  const store = load();
  const now = new Date().toISOString();
  if (!store[eventId]) store[eventId] = {};

  const existing = store[eventId][personId];
  const record: RSVPRecord = {
    eventId,
    personId,
    status,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  store[eventId][personId] = record;
  save(store);
  return record;
}

/** Remove an RSVP entirely (user un-clicks their status). */
export function removeRSVP(eventId: string, personId: string): void {
  const store = load();
  if (store[eventId]) {
    delete store[eventId][personId];
    if (Object.keys(store[eventId]).length === 0) delete store[eventId];
  }
  save(store);
}

/* ── reads ──────────────────────────────────────────────────────────── */

export function getRSVP(
  eventId: string,
  personId: string,
): RSVPRecord | null {
  return load()[eventId]?.[personId] ?? null;
}

export function getEventRSVPs(eventId: string): RSVPRecord[] {
  return Object.values(load()[eventId] ?? {});
}

/** Aggregated counts + lists for the event card UI. */
export function getEventRSVPSummary(eventId: string): RSVPSummary {
  const rsvps = getEventRSVPs(eventId);
  const goingPersonIds = rsvps
    .filter((r) => r.status === "going")
    .map((r) => r.personId);
  const interestedPersonIds = rsvps
    .filter((r) => r.status === "interested")
    .map((r) => r.personId);

  return {
    going: goingPersonIds.length,
    interested: interestedPersonIds.length,
    notGoing: rsvps.filter((r) => r.status === "not-going").length,
    goingPersonIds,
    interestedPersonIds,
  };
}

/** All RSVPs a person has across all events. */
export function getPersonRSVPs(personId: string): RSVPRecord[] {
  const store = load();
  const results: RSVPRecord[] = [];
  for (const eventRsvps of Object.values(store)) {
    if (eventRsvps[personId]) results.push(eventRsvps[personId]);
  }
  return results;
}
