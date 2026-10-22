import type { Person } from "../types";

/** True when a member has opted in with a public booking / availability URL. */
export function isOpenToMeet(person: Person): boolean {
  const url = (person.availabilityUrl ?? "").trim();
  if (!url) return false;
  return /^https?:\/\/[^\s]+$/i.test(url) && url.length <= 220;
}

/** Members who opted in via `availabilityUrl`, sorted by name. */
export function getOpenToMeetMembers(people: Person[]): Person[] {
  return people
    .filter(isOpenToMeet)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }));
}

export function getOpenToMeetUrl(person: Person): string | null {
  if (!isOpenToMeet(person)) return null;
  return (person.availabilityUrl ?? "").trim();
}

export type OpenToMeetFilter = "all" | "connections" | "focus" | "city";

function normalizeCity(city: string | null | undefined): string {
  return String(city || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function focusSet(person: Person | null | undefined): Set<string> {
  const tags = Array.isArray(person?.focusTags) ? person!.focusTags : [];
  return new Set(
    tags.map((t) => String(t || "").trim().toLowerCase()).filter(Boolean),
  );
}

/** True when both people share at least one focus tag (case-insensitive). */
export function sharesFocusAreasWith(a: Person, b: Person | null | undefined): boolean {
  if (!b) return false;
  const theirs = focusSet(b);
  if (theirs.size === 0) return false;
  for (const tag of focusSet(a)) {
    if (theirs.has(tag)) return true;
  }
  return false;
}

/** True when both list the same current city (case-insensitive). */
export function sharesCityWith(a: Person, b: Person | null | undefined): boolean {
  if (!b) return false;
  const cityA = normalizeCity(a.currentCity);
  const cityB = normalizeCity(b.currentCity);
  return Boolean(cityA && cityB && cityA === cityB);
}

export function personMatchesSearch(person: Person, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    person.fullName,
    person.affiliationOrInstitution,
    person.shortProjectTagline,
    person.currentCity,
    person.currentCountry,
    ...(person.focusTags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/**
 * Filter open-to-meet members relative to the signed-in viewer.
 * `connectionIds` is the viewer's bookmark set (may be empty).
 */
export function filterOpenToMeetMembers(options: {
  people: Person[];
  viewer: Person | null;
  connectionIds?: string[];
  filter: OpenToMeetFilter;
  search?: string;
}): Person[] {
  const {
    people,
    viewer,
    connectionIds = [],
    filter,
    search = "",
  } = options;
  const connectionSet = new Set(connectionIds);
  let list = getOpenToMeetMembers(people);

  if (filter === "connections") {
    list = list.filter((p) => connectionSet.has(p.id));
  } else if (filter === "focus" && viewer) {
    list = list.filter((p) => p.id === viewer.id || sharesFocusAreasWith(p, viewer));
  } else if (filter === "city" && viewer) {
    list = list.filter((p) => p.id === viewer.id || sharesCityWith(p, viewer));
  }

  if (search.trim()) {
    list = list.filter((p) => personMatchesSearch(p, search));
  }

  return list;
}
