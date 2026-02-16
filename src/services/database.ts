/**
 * Database Service — Static Mode
 *
 * Loads data from the bundled JSON file (no server required).
 * Write operations are no-ops so the app compiles cleanly;
 * live editing is handled externally (e.g. Google Form → JSON rebuild).
 */

import { Person, TravelWindow, LocationSuggestion, AdminUser, RoleType } from "../types";

/** Cached database so we only fetch the static file once per session. */
let cachedDatabase: {
  people: Person[];
  travelWindows: TravelWindow[];
  suggestions: LocationSuggestion[];
  adminUsers: AdminUser[];
} | null = null;

async function fetchDatabase() {
  if (cachedDatabase) return cachedDatabase;
  const base = import.meta.env.BASE_URL ?? "/";
  const response = await fetch(`${base}data/database.json`);
  if (!response.ok) throw new Error(`Failed to load data: ${response.statusText}`);
  cachedDatabase = await response.json();
  return cachedDatabase!;
}

/** Normalize person: optional fields default; migrate legacy homeBase → current. */
function normalizePerson(
  p: Partial<Person> & { id: string; fullName: string; roleType: RoleType; fellowshipCohortYear: number },
): Person {
  const legacy = p as Partial<Person> & { homeBaseCity?: string; homeBaseCountry?: string };
  const currentCity = p.currentCity?.trim() || legacy.homeBaseCity?.trim() || "";
  const currentCountry = p.currentCountry?.trim() || legacy.homeBaseCountry?.trim() || "";
  return {
    ...p,
    fellowshipEndYear: p.fellowshipEndYear ?? null,
    affiliationOrInstitution: p.affiliationOrInstitution ?? null,
    focusTags: p.focusTags ?? [],
    currentCity,
    currentCountry,
    currentCoordinates: p.currentCoordinates ?? { lat: 0, lng: 0 },
    primaryNode: p.primaryNode ?? "Global",
    profileUrl: p.profileUrl ?? "",
    contactUrlOrHandle: p.contactUrlOrHandle ?? null,
    shortProjectTagline: p.shortProjectTagline ?? "",
    expandedProjectDescription: p.expandedProjectDescription ?? "",
    isAlumni: p.isAlumni ?? false,
  } as Person;
}

// ── Read operations ──────────────────────────────────────────────────

export async function getAllPeople(): Promise<Person[]> {
  const db = await fetchDatabase();
  return (db.people || []).map(normalizePerson);
}

export async function getAllTravelWindows(): Promise<TravelWindow[]> {
  const db = await fetchDatabase();
  return db.travelWindows || [];
}

export async function getAllSuggestions(): Promise<LocationSuggestion[]> {
  return [];
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  return [];
}

// ── Write operations (no-ops in static mode) ─────────────────────────

export async function addPerson(_person: Person): Promise<void> {}
export async function updatePerson(_id: string, _updates: Partial<Person>): Promise<void> {}
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
