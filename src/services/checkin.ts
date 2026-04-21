/**
 * Node check-in persistence — mirrors rsvp.ts architecture.
 *
 * API (Google Sheet) when available, localStorage fallback.
 * Key insight: the sheet is append-only; latest row per (personId, nodeSlug, date)
 * wins by updatedAt. Removal writes a "removed" status locally; the merged
 * reader filters them out so the UI never sees stale ghosts.
 *
 * localStorage key shape:
 *   { [nodeSlug]: { [date]: { [personId]: CheckIn } } }
 */

import type { CheckIn, CheckInType, NodeSlug, DayCheckInSummary } from "../types/events";

import { getApiBase } from "./api-base";
import { publishDataChanged, reportSyncError } from "./sync";

const STORAGE_KEY = "foresightmap_checkins";

function writeHeaders(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = import.meta.env.VITE_FORESIGHT_WRITE_SECRET;
  if (typeof token === "string" && token.length > 0) {
    h["X-Foresight-Write-Secret"] = token;
  }
  return h;
}

type NodeStore = Record<string, Record<string, CheckIn>>;   // date → personId → CheckIn
type Store = Record<string, NodeStore>;                      // nodeSlug → NodeStore

let apiCheckIns: CheckIn[] = [];

/* ── localStorage helpers ──────────────────────────────────────────── */

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

/* ── API communication ─────────────────────────────────────────────── */

export async function fetchCheckInsFromAPI(
  nodeSlug: NodeSlug,
  startDate: string,
  endDate: string,
): Promise<CheckIn[] | null> {
  try {
    const params = new URLSearchParams({ nodeSlug, startDate, endDate });
    const res = await fetch(`${getApiBase()}/checkins?${params}`);
    if (!res.ok) {
      reportSyncError({
        scope: "checkins",
        message: `GET /api/checkins failed with ${res.status}`,
      });
      return null;
    }
    const list = (await res.json()) as CheckIn[];
    const valid = Array.isArray(list) ? list : [];
    // Merge into cache — keep entries outside this window, replace within
    apiCheckIns = [
      ...apiCheckIns.filter(
        (c) => !(c.nodeSlug === nodeSlug && c.date >= startDate && c.date <= endDate),
      ),
      ...valid,
    ];
    return valid;
  } catch (err) {
    reportSyncError({
      scope: "checkins",
      message:
        err instanceof Error && err.message ? err.message : "Could not reach the check-ins API.",
      cause: err,
    });
    return null;
  }
}

/* ── Merge logic ───────────────────────────────────────────────────── */

function mergeIntoStore(store: Store, records: CheckIn[]): void {
  for (const r of records) {
    if (!r.personId || !r.nodeSlug || !r.date) continue;
    if (!store[r.nodeSlug]) store[r.nodeSlug] = {};
    if (!store[r.nodeSlug][r.date]) store[r.nodeSlug][r.date] = {};
    const existing = store[r.nodeSlug][r.date][r.personId];
    if (!existing || new Date(r.updatedAt) > new Date(existing.updatedAt)) {
      store[r.nodeSlug][r.date][r.personId] = {
        ...r,
        fullName: r.fullName ?? existing?.fullName,
      };
    }
  }
}

function getMergedStore(): Store {
  const local = loadLocal();
  const store: Store = JSON.parse(JSON.stringify(local));
  mergeIntoStore(store, apiCheckIns);
  return store;
}

/* ── Writes ────────────────────────────────────────────────────────── */

export async function checkIn(
  personId: string,
  fullName: string,
  nodeSlug: NodeSlug,
  date: string,
  type: CheckInType = "checkin",
): Promise<CheckIn> {
  const now = new Date().toISOString();
  const store = loadLocal();
  if (!store[nodeSlug]) store[nodeSlug] = {};
  if (!store[nodeSlug][date]) store[nodeSlug][date] = {};
  const existing = store[nodeSlug][date][personId];

  const record: CheckIn = {
    personId,
    fullName,
    nodeSlug,
    date,
    type,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  store[nodeSlug][date][personId] = record;
  saveLocal(store);

  try {
    const res = await fetch(`${getApiBase()}/checkins`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      let msg = `Could not save check-in (${res.status})`;
      try {
        const j = (await res.json()) as { error?: string };
        if (typeof j?.error === "string") msg = j.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    const created = (await res.json()) as CheckIn;
    apiCheckIns = apiCheckIns.filter(
      (c) => !(c.personId === personId && c.nodeSlug === nodeSlug && c.date === date),
    );
    apiCheckIns.push(created);
    publishDataChanged("checkins");
  } catch (e) {
    const net =
      e instanceof TypeError ||
      (e instanceof Error &&
        (e.message === "Failed to fetch" || e.message.includes("Load failed")));
    if (net) {
      throw new Error("Offline or server unreachable — check-in saved on this device only.");
    }
    throw e instanceof Error ? e : new Error(String(e));
  }

  return record;
}

export function removeCheckIn(personId: string, nodeSlug: NodeSlug, date: string): void {
  const store = loadLocal();
  if (store[nodeSlug]?.[date]) {
    delete store[nodeSlug][date][personId];
    if (Object.keys(store[nodeSlug][date]).length === 0) delete store[nodeSlug][date];
    if (Object.keys(store[nodeSlug]).length === 0) delete store[nodeSlug];
  }
  saveLocal(store);
  apiCheckIns = apiCheckIns.filter(
    (c) => !(c.personId === personId && c.nodeSlug === nodeSlug && c.date === date),
  );
}

/* ── Reads (sync, merged) ──────────────────────────────────────────── */

export function getCheckInsForDay(nodeSlug: NodeSlug, date: string): CheckIn[] {
  const store = getMergedStore();
  return Object.values(store[nodeSlug]?.[date] ?? {});
}

export function getCheckInsForWeek(
  nodeSlug: NodeSlug,
  weekDates: string[],
): DayCheckInSummary[] {
  const store = getMergedStore();
  return weekDates.map((date) => ({
    date,
    people: Object.values(store[nodeSlug]?.[date] ?? {}),
  }));
}

export function getPersonCheckIns(personId: string): CheckIn[] {
  const store = getMergedStore();
  const results: CheckIn[] = [];
  for (const nodeStore of Object.values(store)) {
    for (const dayStore of Object.values(nodeStore)) {
      if (dayStore[personId]) results.push(dayStore[personId]);
    }
  }
  return results.sort((a, b) => a.date.localeCompare(b.date));
}

export function isPersonCheckedIn(
  personId: string,
  nodeSlug: NodeSlug,
  date: string,
): boolean {
  const store = getMergedStore();
  return !!(store[nodeSlug]?.[date]?.[personId]);
}

/* ── Date helpers ──────────────────────────────────────────────────── */

/** YYYY-MM-DD for a Date object. */
export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Returns an array of YYYY-MM-DD strings for the Mon–Sun week containing `ref`. */
export function getWeekDates(ref: Date): string[] {
  const d = new Date(ref);
  const day = d.getDay();
  // Shift so Monday = 0
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(toDateKey(new Date(d)));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}
