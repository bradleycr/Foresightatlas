/**
 * Database Service — Sheet as source of truth
 *
 * Loads data from GET /api/database (backed by the Google Sheet).
 * No static JSON fallback; the app requires the API and sheet to be configured.
 */

import { Person, TravelWindow, LocationSuggestion, AdminUser, RoleType } from "../types";
import type { RSVPRecord } from "../types/events";
import type { NodeEvent } from "../types/events";

/** Base path for API requests. Same origin; works with any BASE_URL (e.g. / or /app/). */
function getApiBase(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const baseNorm = base.endsWith("/") ? base.slice(0, -1) : base;
  return baseNorm ? `${baseNorm}/api` : "/api";
}

/** Cached database so we only fetch once per session. */
let cachedDatabase: {
  people: Person[];
  travelWindows: TravelWindow[];
  suggestions: LocationSuggestion[];
  adminUsers: AdminUser[];
  rsvps?: RSVPRecord[];
  events?: NodeEvent[];
} | null = null;

const FETCH_TIMEOUT_MS = 15_000;

/** Cohort year: only 1900–2100 are valid; Excel serials / garbage (e.g. 45966) → null so we store 0 (unknown). */
function normalizeYearValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const y = Math.trunc(value);
  if (y >= 1900 && y <= 2100) return y;
  return null;
}

function normalizeDateValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpochMs = Date.UTC(1899, 11, 30);
    return new Date(excelEpochMs + value * 24 * 60 * 60 * 1000).toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (numeric > 3000) {
        const excelEpochMs = Date.UTC(1899, 11, 30);
        return new Date(excelEpochMs + numeric * 24 * 60 * 60 * 1000).toISOString();
      }
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDatabase() {
  if (cachedDatabase) return cachedDatabase;
  const apiBase = getApiBase();
  const apiUrl = `${apiBase}/database`.replace(/([^:]\/)\/+/g, "$1");

  const response = await fetchWithTimeout(apiUrl);
  if (!response.ok) {
    const text = await response.text();
    let message = `Failed to load data (${response.status}).`;
    try {
      const json = JSON.parse(text);
      if (json?.error) message = json.error;
    } catch {
      if (text) message = text.slice(0, 200);
    }
    throw new Error(message);
  }

  const raw = await response.json();
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.people)) {
    throw new Error("Invalid response: missing or non-array 'people'.");
  }
  raw.people = dedupePeople(raw.people as unknown[]);
  cachedDatabase = raw as typeof cachedDatabase;
  return cachedDatabase;
}

export function clearDatabaseCache(): void {
  cachedDatabase = null;
}

/** Normalize person: optional fields default; migrate legacy homeBase → current. */
function normalizePerson(
  p: Partial<Person> & { id: string; fullName: string; roleType: RoleType; fellowshipCohortYear: number },
): Person {
  const legacy = p as Partial<Person> & { homeBaseCity?: string; homeBaseCountry?: string };
  const currentCity = p.currentCity?.trim() || legacy.homeBaseCity?.trim() || "";
  const currentCountry = p.currentCountry?.trim() || legacy.homeBaseCountry?.trim() || "";
  /** Display name only: first line of fullName so internal notes in the sheet never leak into the UI. */
  const fullName = (p.fullName ?? "")
    .split(/\r?\n/)[0]
    ?.trim() || (p.fullName ?? "").trim() || "";
  return {
    ...p,
    fullName,
    fellowshipCohortYear: normalizeYearValue(p.fellowshipCohortYear) ?? 0,
    fellowshipEndYear: normalizeYearValue(p.fellowshipEndYear) ?? null,
    affiliationOrInstitution: p.affiliationOrInstitution ?? null,
    focusTags: p.focusTags ?? [],
    currentCity,
    currentCountry,
    currentCoordinates: p.currentCoordinates ?? { lat: 0, lng: 0 },
    primaryNode: p.primaryNode ?? "Global",
    profileUrl: p.profileUrl ?? "",
    profileImageUrl: p.profileImageUrl ?? null,
    contactUrlOrHandle: p.contactUrlOrHandle ?? null,
    shortProjectTagline: p.shortProjectTagline ?? "",
    expandedProjectDescription: p.expandedProjectDescription ?? "",
    isAlumni: p.isAlumni ?? false,
  } as Person;
}

function normalizePersonName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function scorePersonRichness(person: Partial<Person>): number {
  let score = 0;
  const add = (condition: boolean, amount = 1) => {
    if (condition) score += amount;
  };

  add(Boolean(person.fullName), 4);
  add(Boolean(person.roleType), 2);
  add(Boolean(person.fellowshipCohortYear), 2);
  add(person.fellowshipEndYear !== null && person.fellowshipEndYear !== undefined, 1);
  add(Boolean(person.affiliationOrInstitution), 1);
  add((person.focusTags?.length ?? 0) > 0, 2);
  add(Boolean(person.currentCity), 3);
  add(Boolean(person.currentCountry), 2);
  add(
    Boolean(person.currentCoordinates) &&
      ((person.currentCoordinates?.lat ?? 0) !== 0 ||
        (person.currentCoordinates?.lng ?? 0) !== 0),
    4,
  );
  add(Boolean(person.profileUrl), 1);
  add(Boolean(person.contactUrlOrHandle), 1);
  add(Boolean(person.shortProjectTagline), 1);
  add(Boolean(person.expandedProjectDescription), 1);
  return score;
}

function choosePreferredPerson(records: Array<Partial<Person>>): Partial<Person> {
  return [...records].sort((left, right) => {
    const byScore = scorePersonRichness(right) - scorePersonRichness(left);
    if (byScore !== 0) return byScore;
    return String(left.id ?? "").localeCompare(String(right.id ?? ""));
  })[0];
}

function dedupePeople(rawPeople: unknown[]): unknown[] {
  const byId = new Map<string, Partial<Person>>();
  const noId: Partial<Person>[] = [];

  for (const candidate of rawPeople as Array<Partial<Person>>) {
    const id = String(candidate?.id ?? "").trim();
    if (!id) {
      noId.push(candidate);
      continue;
    }

    const existing = byId.get(id);
    byId.set(id, existing ? choosePreferredPerson([existing, candidate]) : candidate);
  }

  const byName = new Map<string, Partial<Person>[]>();
  for (const person of [...byId.values(), ...noId]) {
    const normalizedName = normalizePersonName(person.fullName);
    if (!normalizedName) continue;
    const bucket = byName.get(normalizedName) ?? [];
    bucket.push(person);
    byName.set(normalizedName, bucket);
  }

  const chosenByName = new Map<string, Partial<Person>>();
  for (const [name, bucket] of byName.entries()) {
    chosenByName.set(name, choosePreferredPerson(bucket));
  }

  const deduped = [...chosenByName.values()];
  const dropped = rawPeople.length - deduped.length;
  if (dropped > 0) {
    console.warn(`Deduped ${dropped} duplicate people records while loading database.`);
  }
  return deduped;
}

function normalizeTravelWindow(raw: Partial<TravelWindow> & { id: string; personId: string }): TravelWindow {
  return {
    id: raw.id,
    personId: raw.personId.trim(),
    title: raw.title ?? "",
    city: raw.city?.trim() ?? "",
    country: raw.country?.trim() ?? "",
    coordinates: raw.coordinates ?? { lat: 0, lng: 0 },
    startDate: normalizeDateValue(raw.startDate),
    endDate: normalizeDateValue(raw.endDate),
    type: raw.type ?? "Other",
    notes: raw.notes ?? "",
  };
}

// ── Read operations ──────────────────────────────────────────────────

export async function getAllPeople(): Promise<Person[]> {
  const db = await fetchDatabase();
  return (db.people || []).map(normalizePerson);
}

export async function getAllTravelWindows(): Promise<TravelWindow[]> {
  const db = await fetchDatabase();
  return (db.travelWindows || []).map((tw) =>
    normalizeTravelWindow(tw as Partial<TravelWindow> & { id: string; personId: string }),
  );
}

export async function getAllSuggestions(): Promise<LocationSuggestion[]> {
  return [];
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  return [];
}

/** RSVPs from the sheet (via GET /api/database). */
export async function getRsvps(): Promise<RSVPRecord[]> {
  const db = await fetchDatabase();
  return db.rsvps ?? [];
}

/** Events from the sheet (via GET /api/database). Returns [] when sheet has no Events tab or API not configured. */
export async function getEventsFromSheet(): Promise<NodeEvent[]> {
  try {
    const db = await fetchDatabase();
    return Array.isArray(db.events) ? db.events : [];
  } catch {
    return [];
  }
}

// ── Write operations (no-ops in static mode) ─────────────────────────

export async function addPerson(_person: Person): Promise<void> {}

/**
 * Self-register a new directory profile. Creates a new row in the RealData sheet,
 * signs the user in, and updates the in-memory cache. Use when the user is not
 * in the directory and clicks "Add yourself".
 */
export async function createPerson(
  person: Partial<Person> & Pick<Person, "fullName" | "roleType" | "primaryNode">,
  password: string,
): Promise<{ person: Person; auth: { token: string; expiresAt: string; mustChangePassword: boolean } }> {
  const url = `${getApiBase()}/member-register`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ person, password }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const status = response.status;
    const msg = payload?.error ?? payload?.message ?? response.statusText ?? "Registration failed";
    if (status === 404 || status === 502) {
      throw new Error(
        "Registration endpoint is not available. Make sure the API is running (e.g. run `pnpm dev` which starts both the app and the API).",
      );
    }
    throw new Error(msg);
  }

  const createdPerson = payload.person as Person | undefined;
  if (!createdPerson?.id) {
    throw new Error("Registration succeeded but no person was returned.");
  }

  const normalized = normalizePerson(createdPerson);
  if (cachedDatabase) {
    cachedDatabase.people.push(normalized);
  }

  return {
    person: normalized,
    auth: payload.auth as {
      token: string;
      expiresAt: string;
      mustChangePassword: boolean;
    },
  };
}

export async function updatePerson(
  id: string,
  updates: Partial<Person>,
  token: string,
): Promise<{ person: Person; auth?: { token: string; expiresAt: string; mustChangePassword: boolean } }> {
  const url = `${getApiBase()}/profile`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      person: {
        ...updates,
        id,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const status = response.status;
    const msg = payload?.error ?? payload?.message ?? response.statusText ?? "Failed to save profile";
    if (status === 404 || status === 502) {
      throw new Error(
        "Profile save endpoint is not available. Make sure the API is running (e.g. run `pnpm dev` which starts both the app and the API).",
      );
    }
    throw new Error(msg);
  }

  const updatedPerson = payload.person as Person | undefined;
  if (!updatedPerson?.id) {
    throw new Error("Profile save succeeded but no updated person was returned.");
  }

  const normalized = normalizePerson(updatedPerson);
  if (cachedDatabase) {
    const existingIndex = cachedDatabase.people.findIndex((entry) => entry.id === normalized.id);
    if (existingIndex >= 0) {
      cachedDatabase.people[existingIndex] = normalized;
    } else {
      cachedDatabase.people.push(normalized);
    }
  }

  return {
    person: normalized,
    auth: payload.auth as
      | { token: string; expiresAt: string; mustChangePassword: boolean }
      | undefined,
  };
}
export async function deletePerson(_id: string): Promise<void> {}

export async function addTravelWindow(_tw: TravelWindow): Promise<void> {}
export async function updateTravelWindow(_id: string, _updates: Partial<TravelWindow>): Promise<void> {}
export async function deleteTravelWindow(_id: string): Promise<void> {}

export async function addSuggestion(_s: LocationSuggestion): Promise<void> {}
export async function updateSuggestionStatus(_id: string, _status: LocationSuggestion["status"]): Promise<void> {}

// ── ID helpers (kept so existing code compiles) ──────────────────────

export const generatePersonId = (): string => `p${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
export const generateTravelWindowId = (): string => `tw${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
export const generateSuggestionId = (): string => `s${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
