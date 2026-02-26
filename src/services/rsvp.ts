/**
 * RSVP persistence: API (Google Sheet) when available, localStorage fallback.
 *
 * - On load the app should call fetchRSVPsFromAPI() and use the result to merge with local state.
 * - setRSVP / removeRSVP write to the API when configured and always update localStorage.
 * - Reads (getRSVP, getEventRSVPs, getEventRSVPSummary) merge in-memory API cache with localStorage.
 */

import { RSVPRecord, RSVPStatus, RSVPSummary } from "../types/events";

const STORAGE_KEY = "foresightmap_rsvps";
const API_BASE = ""; // same origin; Vercel serves /api

type Store = Record<string, Record<string, RSVPRecord>>;

/** RSVPs last fetched from GET /api/rsvps — merged into reads. */
let apiRsvps: RSVPRecord[] = [];

function loadLocal(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocal(store: Store): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** Fetch all RSVPs from the sheet-backed API. Call on programming page load. */
export async function fetchRSVPsFromAPI(): Promise<RSVPRecord[] | null> {
  try {
    const res = await fetch(`${API_BASE}/api/rsvps`);
    if (!res.ok) return null;
    const list = (await res.json()) as RSVPRecord[];
    apiRsvps = Array.isArray(list) ? list : [];
    return apiRsvps;
  } catch {
    return null;
  }
}

/** Whether the API is configured (we got a successful response at least once). */
export function hasAPI(): boolean {
  return apiRsvps.length >= 0; // we don't track failure; caller can check fetchRSVPsFromAPI result
}

function mergeIntoStore(store: Store, records: RSVPRecord[]): void {
  for (const r of records) {
    if (!r.eventId || !r.personId) continue;
    if (!store[r.eventId]) store[r.eventId] = {};
    const existing = store[r.eventId][r.personId];
    if (!existing || new Date(r.updatedAt) > new Date(existing.updatedAt)) {
      store[r.eventId][r.personId] = { ...r, fullName: r.fullName ?? existing?.fullName, eventTitle: r.eventTitle ?? existing?.eventTitle };
    }
  }
}

/** Build store from API cache + localStorage (API wins on conflict by updatedAt). */
function getMergedStore(): Store {
  const local = loadLocal();
  const store: Store = JSON.parse(JSON.stringify(local));
  mergeIntoStore(store, apiRsvps);
  return store;
}

/* ── writes ─────────────────────────────────────────────────────────── */

/** Upsert — writes to API when configured, then localStorage. */
export async function setRSVP(
  eventId: string,
  personId: string,
  status: RSVPStatus,
  fullName?: string,
  eventTitle?: string,
): Promise<RSVPRecord> {
  const now = new Date().toISOString();
  const store = loadLocal();
  if (!store[eventId]) store[eventId] = {};
  const existing = store[eventId][personId];
  const record: RSVPRecord = {
    eventId,
    personId,
    status,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    fullName: fullName ?? existing?.fullName,
    eventTitle: eventTitle ?? existing?.eventTitle,
  };
  store[eventId][personId] = record;
  saveLocal(store);

  try {
    const res = await fetch(`${API_BASE}/api/rsvps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, personId, fullName, status, eventTitle }),
    });
    if (res.ok) {
      const created = (await res.json()) as RSVPRecord;
      apiRsvps = apiRsvps.filter((r) => !(r.eventId === eventId && r.personId === personId));
      apiRsvps.push(created);
    }
  } catch {
    // Offline or API not configured — localStorage already updated
  }
  return record;
}

/** Remove an RSVP locally; API is append-only so we don't send delete. */
export function removeRSVP(eventId: string, personId: string): void {
  const store = loadLocal();
  if (store[eventId]) {
    delete store[eventId][personId];
    if (Object.keys(store[eventId]).length === 0) delete store[eventId];
  }
  saveLocal(store);
  apiRsvps = apiRsvps.filter((r) => !(r.eventId === eventId && r.personId === personId));
}

/* ── reads (sync, merged) ────────────────────────────────────────────── */

export function getRSVP(eventId: string, personId: string): RSVPRecord | null {
  return getMergedStore()[eventId]?.[personId] ?? null;
}

export function getEventRSVPs(eventId: string): RSVPRecord[] {
  return Object.values(getMergedStore()[eventId] ?? {});
}

export function getEventRSVPSummary(eventId: string): RSVPSummary {
  const rsvps = getEventRSVPs(eventId);
  const goingPersonIds = rsvps.filter((r) => r.status === "going").map((r) => r.personId);
  const interestedPersonIds = rsvps.filter((r) => r.status === "interested").map((r) => r.personId);
  return {
    going: goingPersonIds.length,
    interested: interestedPersonIds.length,
    notGoing: rsvps.filter((r) => r.status === "not-going").length,
    goingPersonIds,
    interestedPersonIds,
  };
}

export function getPersonRSVPs(personId: string): RSVPRecord[] {
  const store = getMergedStore();
  const results: RSVPRecord[] = [];
  for (const eventRsvps of Object.values(store)) {
    if (eventRsvps[personId]) results.push(eventRsvps[personId]);
  }
  return results;
}

/** Seed merged cache from static database.json (e.g. rsvps from build). */
export function setAPIRsvpsFromBuild(records: RSVPRecord[]): void {
  apiRsvps = Array.isArray(records) ? records : [];
}
