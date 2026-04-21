/**
 * RSVP persistence — Google Sheet via `/api/rsvps`, with localStorage as an
 * offline buffer.
 *
 * Design
 * ------
 * • Source of truth:   the sheet. Served by `api/rsvps.js` (Vercel) or by
 *   the Express dev server, which mounts the same handler.
 * • Writes:            POST to `/api/rsvps` which appends a new row. The
 *   latest row for (eventId, personId) by `updatedAt` wins. Network failures
 *   fall back to localStorage so a device offline at a node can still mark
 *   "going" and sync later when online.
 * • Reads:             `fetchRSVPsFromAPI()` pulls the full list into an
 *   in-memory cache, which is merged with localStorage on every read.
 * • Withdraw semantics: clicking a selected RSVP button does NOT just wipe
 *   localStorage anymore — it writes `status = "withdrawn"` so other tabs
 *   and returning sessions also see the withdrawal. See {@link withdrawRSVP}.
 *
 * After any successful write we call `publishDataChanged("rsvps")` so every
 * other open tab can refetch, and current-tab components re-render.
 */

import { RSVPRecord, RSVPStatus, RSVPSummary } from "../types/events";

import { getApiBase } from "./api-base";
import { publishDataChanged, reportSyncError } from "./sync";

const STORAGE_KEY = "foresightatlas_rsvps";

/**
 * Build headers for write requests. Includes the optional shared secret
 * when configured — see `docs/VERCEL_ENV.md` for how it's used to rate-limit
 * anonymous abuse on public POST endpoints.
 */
function writeHeaders(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = import.meta.env.VITE_FORESIGHT_WRITE_SECRET;
  if (typeof token === "string" && token.length > 0) {
    h["X-Foresight-Write-Secret"] = token;
  }
  return h;
}

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

/**
 * Fetch all RSVPs from the sheet-backed API. Call on programming page load
 * and after any cross-tab data-change notification. Returns `null` on
 * failure and reports the error via {@link reportSyncError} so App-level
 * UI can decide whether to surface a toast.
 */
export async function fetchRSVPsFromAPI(): Promise<RSVPRecord[] | null> {
  try {
    const res = await fetch(`${getApiBase()}/rsvps`);
    if (!res.ok) {
      reportSyncError({
        scope: "rsvps",
        message: `GET /api/rsvps failed with ${res.status}`,
      });
      return null;
    }
    const list = (await res.json()) as RSVPRecord[];
    apiRsvps = Array.isArray(list) ? list : [];
    return apiRsvps;
  } catch (err) {
    reportSyncError({
      scope: "rsvps",
      message:
        err instanceof Error && err.message ? err.message : "Could not reach the RSVPs API.",
      cause: err,
    });
    return null;
  }
}

/**
 * Merge a flat list of RSVP records into a store, keyed by (eventId, personId),
 * keeping the record with the latest `updatedAt` per key. `withdrawn` records
 * are preserved in the store because they're still the authoritative latest
 * state — we filter them out at read/summary time instead.
 */
function mergeIntoStore(store: Store, records: RSVPRecord[]): void {
  for (const r of records) {
    if (!r.eventId || !r.personId) continue;
    if (!store[r.eventId]) store[r.eventId] = {};
    const existing = store[r.eventId][r.personId];
    if (!existing || new Date(r.updatedAt) > new Date(existing.updatedAt)) {
      store[r.eventId][r.personId] = {
        ...r,
        fullName: r.fullName ?? existing?.fullName,
        eventTitle: r.eventTitle ?? existing?.eventTitle,
      };
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

/**
 * Upsert an RSVP — writes to the API when reachable, and always to localStorage
 * so the change survives an offline moment. On success, notifies every tab
 * (including this one's other components) via the sync channel.
 */
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
    const res = await fetch(`${getApiBase()}/rsvps`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ eventId, personId, fullName, status, eventTitle }),
    });
    if (!res.ok) {
      let msg = `Could not save RSVP (${res.status})`;
      try {
        const j = (await res.json()) as { error?: string };
        if (typeof j?.error === "string") msg = j.error;
      } catch {
        /* swallow — body might not be JSON */
      }
      throw new Error(msg);
    }
    const created = (await res.json()) as RSVPRecord;
    apiRsvps = apiRsvps.filter((r) => !(r.eventId === eventId && r.personId === personId));
    apiRsvps.push(created);
    publishDataChanged("rsvps");
  } catch (e) {
    const net =
      e instanceof TypeError ||
      (e instanceof Error &&
        (e.message === "Failed to fetch" || e.message.includes("Load failed")));
    if (net) {
      throw new Error("Offline or server unreachable — RSVP saved on this device only.");
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  return record;
}

/**
 * Withdraw an RSVP — writes a `status = "withdrawn"` row to the sheet so it
 * becomes the authoritative latest state. This replaces the old local-only
 * {@link removeRSVP}, which silently left the previous "going" row as the
 * latest and caused the UI to keep showing the user as attending after a
 * reload or from another tab.
 */
export async function withdrawRSVP(
  eventId: string,
  personId: string,
  fullName?: string,
  eventTitle?: string,
): Promise<RSVPRecord> {
  return setRSVP(eventId, personId, "withdrawn", fullName, eventTitle);
}

/**
 * Legacy local-only remove. Kept as a safety net for callers that genuinely
 * want to drop a pending local-offline write without touching the API.
 * @deprecated Prefer {@link withdrawRSVP} — it persists to the sheet so other
 *             tabs and future sessions see the withdrawal.
 */
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

/**
 * Returns the record as-stored (including `withdrawn`) so components can
 * distinguish "no record" (never RSVP'd) from "withdrawn" (explicitly
 * un-RSVP'd) if they ever need to. The button group UI helper collapses
 * `withdrawn` to `null` so the RSVP pills render as unselected.
 */
export function getRSVP(eventId: string, personId: string): RSVPRecord | null {
  return getMergedStore()[eventId]?.[personId] ?? null;
}

/**
 * The user-facing status — `withdrawn` becomes `null` so the button group
 * treats it the same as "never RSVP'd". This is the function components
 * should use when they only care "what does the pill show".
 */
export function getUserRSVPStatus(eventId: string, personId: string): RSVPStatus | null {
  const record = getRSVP(eventId, personId);
  if (!record || record.status === "withdrawn") return null;
  return record.status;
}

export function getEventRSVPs(eventId: string): RSVPRecord[] {
  return Object.values(getMergedStore()[eventId] ?? {});
}

/**
 * Aggregated counts for one event. Withdrawn and not-going rows are excluded
 * from all totals — `going`/`interested` represent the audience you actually
 * care about, and `notGoing` counts explicit "Can't go" responses only.
 */
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

/** Seed the merged cache from `/api/database` (which already includes RSVPs). */
export function setAPIRsvpsFromBuild(records: RSVPRecord[]): void {
  apiRsvps = Array.isArray(records) ? records : [];
}
