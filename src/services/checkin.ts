/**
 * Node check-in persistence — mirrors rsvp.ts architecture.
 *
 * **Production source of truth:** `POST /api/checkins` appends rows to the **CheckIns**
 * Google Sheet tab. Every other device loads via `GET /api/checkins` (same sheet).
 * localStorage is an **offline / optimistic cache only** — it must not replace a
 * failed server write: we roll back the optimistic row if POST does not succeed.
 *
 * Append-only sheet: latest row per (personId, nodeSlug, date) wins by `updatedAt`.
 * Cancelling at the table sends `type: "withdrawn"` to the sheet so removals sync.
 *
 * localStorage key shape:
 *   { [nodeSlug]: { [date]: { [personId]: CheckIn } } }
 */

import type { CheckIn, CheckInType, NodeSlug, DayCheckInSummary } from "../types/events";

import { getApiBase } from "./api-base";
import { publishDataChanged } from "./sync";

const STORAGE_KEY = "foresightatlas_checkins";

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

/** Drop empty nested objects after deleting a day or person entry. */
function pruneEmptyStoreBranch(store: Store, nodeSlug: NodeSlug, date: string): void {
  if (store[nodeSlug]?.[date] && Object.keys(store[nodeSlug][date]).length === 0) {
    delete store[nodeSlug][date];
  }
  if (store[nodeSlug] && Object.keys(store[nodeSlug]).length === 0) {
    delete store[nodeSlug];
  }
}

function removeLocalCheckIn(personId: string, nodeSlug: NodeSlug, date: string): void {
  const store = loadLocal();
  if (store[nodeSlug]?.[date]?.[personId]) {
    delete store[nodeSlug][date][personId];
    pruneEmptyStoreBranch(store, nodeSlug, date);
    saveLocal(store);
  }
}

/* ── API communication ─────────────────────────────────────────────── */

/*
 * Fetch server check-ins for a (node, date-range) window.
 *
 * Check-ins are soft-sync: the UI always has a full localStorage cache, and
 * the server-side sheet read can fail for benign reasons (missing tab, API
 * quota, transient network). Surfacing those as app-wide "Couldn't sync with
 * the server" toasts is misleading — the rest of the app is fine. So we log
 * every failure to the console for engineers and silently return `null`,
 * letting callers fall back to local data without alarming the user.
 */
function checkInMergeKey(c: CheckIn): string {
  return `${c.personId}|${c.nodeSlug}|${c.date}`;
}

/**
 * Merges GET results with any in-range rows already in `apiCheckIns` so a
 * slow or empty sheet read never wipes a row we just POSTed (append-only
 * sheets can lag a beat before the new line appears in reads).
 */
function mergeApiCheckInsRange(
  nodeSlug: NodeSlug,
  startDate: string,
  endDate: string,
  fromServer: CheckIn[],
): void {
  const inRange = (c: CheckIn) =>
    c.nodeSlug === nodeSlug && c.date >= startDate && c.date <= endDate;

  const merged = new Map<string, CheckIn>();
  for (const c of apiCheckIns.filter(inRange)) {
    merged.set(checkInMergeKey(c), c);
  }
  for (const r of fromServer) {
    const k = checkInMergeKey(r);
    const prev = merged.get(k);
    if (!prev || new Date(r.updatedAt) >= new Date(prev.updatedAt)) {
      merged.set(k, r);
    }
  }

  apiCheckIns = [...apiCheckIns.filter((c) => !inRange(c)), ...merged.values()];
}

export async function fetchCheckInsFromAPI(
  nodeSlug: NodeSlug,
  startDate: string,
  endDate: string,
): Promise<CheckIn[] | null> {
  try {
    const params = new URLSearchParams({ nodeSlug, startDate, endDate });
    const res = await fetch(`${getApiBase()}/checkins?${params}`);
    if (!res.ok) {
      console.warn(
        `[checkins] GET /api/checkins returned ${res.status}; using local cache only.`,
      );
      return null;
    }
    const list = (await res.json()) as CheckIn[];
    const valid = Array.isArray(list) ? list : [];
    mergeApiCheckInsRange(nodeSlug, startDate, endDate, valid);
    return valid;
  } catch (err) {
    console.warn(
      "[checkins] GET /api/checkins network error; using local cache only.",
      err,
    );
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
  const existingBefore = store[nodeSlug][date][personId];

  const record: CheckIn = {
    personId,
    fullName,
    nodeSlug,
    date,
    type,
    createdAt: existingBefore?.createdAt ?? now,
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
    /* Reconcile with the sheet so “The Table” and other views match server truth when the row is visible. */
    await fetchCheckInsFromAPI(nodeSlug, date, date);
    publishDataChanged("checkins");
  } catch (e) {
    /* Sheet did not get the row — undo optimistic local write so UI matches cross-device truth. */
    const s = loadLocal();
    if (s[nodeSlug]?.[date]?.[personId]) {
      if (existingBefore) {
        s[nodeSlug][date][personId] = existingBefore;
      } else {
        delete s[nodeSlug][date][personId];
        pruneEmptyStoreBranch(s, nodeSlug, date);
      }
      saveLocal(s);
    }
    apiCheckIns = apiCheckIns.filter(
      (c) => !(c.personId === personId && c.nodeSlug === nodeSlug && c.date === date),
    );

    const net =
      e instanceof TypeError ||
      (e instanceof Error &&
        (e.message === "Failed to fetch" || e.message.includes("Load failed")));
    if (net) {
      throw new Error(
        "Offline or server unreachable — check-in was not saved. Connect and try again so everyone sees you on The Table.",
      );
    }
    throw e instanceof Error ? e : new Error(String(e));
  }

  return record;
}

/**
 * Withdraw presence for a day — **appends `withdrawn` to the Google Sheet** so other
 * devices see the update on the next GET (same append-only rules as check-in).
 */
export async function withdrawCheckIn(
  personId: string,
  fullName: string,
  nodeSlug: NodeSlug,
  date: string,
): Promise<void> {
  const now = new Date().toISOString();
  const record: CheckIn = {
    personId,
    fullName,
    nodeSlug,
    date,
    type: "withdrawn",
    createdAt: now,
    updatedAt: now,
  };

  try {
    const res = await fetch(`${getApiBase()}/checkins`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      let msg = `Could not sync withdrawal (${res.status})`;
      try {
        const j = (await res.json()) as { error?: string };
        if (typeof j?.error === "string") msg = j.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    const created = (await res.json()) as CheckIn;
    removeLocalCheckIn(personId, nodeSlug, date);
    apiCheckIns = apiCheckIns.filter(
      (c) => !(c.personId === personId && c.nodeSlug === nodeSlug && c.date === date),
    );
    apiCheckIns.push(created);
    await fetchCheckInsFromAPI(nodeSlug, date, date);
    publishDataChanged("checkins");
  } catch (e) {
    const net =
      e instanceof TypeError ||
      (e instanceof Error &&
        (e.message === "Failed to fetch" || e.message.includes("Load failed")));
    if (net) {
      throw new Error(
        "Offline or server unreachable — withdrawal not saved. Your name may still show until the server accepts the update.",
      );
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
}

/* ── Reads (sync, merged) ──────────────────────────────────────────── */

export function getCheckInsForDay(nodeSlug: NodeSlug, date: string): CheckIn[] {
  const store = getMergedStore();
  return Object.values(store[nodeSlug]?.[date] ?? {}).filter((c) => c.type !== "withdrawn");
}

export function getCheckInsForWeek(
  nodeSlug: NodeSlug,
  weekDates: string[],
): DayCheckInSummary[] {
  const store = getMergedStore();
  return weekDates.map((date) => ({
    date,
    people: Object.values(store[nodeSlug]?.[date] ?? {}).filter((c) => c.type !== "withdrawn"),
  }));
}

export function getPersonCheckIns(personId: string): CheckIn[] {
  const store = getMergedStore();
  const results: CheckIn[] = [];
  for (const nodeStore of Object.values(store)) {
    for (const dayStore of Object.values(nodeStore)) {
      if (dayStore[personId] && dayStore[personId].type !== "withdrawn") {
        results.push(dayStore[personId]);
      }
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
  const c = store[nodeSlug]?.[date]?.[personId];
  return !!c && c.type !== "withdrawn";
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
