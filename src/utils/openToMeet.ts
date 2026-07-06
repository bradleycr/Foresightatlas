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
