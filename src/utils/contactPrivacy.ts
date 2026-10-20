/**
 * Contact privacy for senior roles that stay on the atlas but must not
 * expose outreach channels (Prize Winners + Senior Fellows).
 * Mirrors server/role-types CONTACT_SUPPRESSED_ROLES.
 */

import type { Person, RoleType } from "../types";

const CONTACT_SUPPRESSED_ROLES = new Set<RoleType>([
  "Senior Fellow",
  "Prize Winner",
]);

function roleList(person: Person): string[] {
  if (Array.isArray(person.roleTypes) && person.roleTypes.length) {
    return person.roleTypes.map((r) => String(r || "").trim()).filter(Boolean);
  }
  const single = String(person.roleType || "").trim();
  return single ? [single] : [];
}

/** Server already redacts these; client also gates the contact UI. */
export function isContactSuppressed(person: Person): boolean {
  return roleList(person).some((role) =>
    CONTACT_SUPPRESSED_ROLES.has(role as RoleType),
  );
}

/** Institute biography page. Safe to show even when personal contact is withheld. */
export function isForesightPeopleProfileUrl(value: string | null | undefined): boolean {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host !== "foresight.org" && host !== "www.foresight.org") return false;
    return /^\/people\/[a-z0-9-]+\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

/** Shared empty-state copy when contact is missing or withheld. */
export const CONTACT_NOT_SHOWN_MESSAGE =
  "This person has not added contact info yet.";

export const MISSING_LOCATION_MESSAGE =
  "This person has not added a map location yet.";

export const MISSING_DETAILS_MESSAGE =
  "This person has not added project or bio details yet.";
