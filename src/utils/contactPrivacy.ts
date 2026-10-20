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

const HONORIFICS = new Set(["dr", "prof", "professor", "mr", "mrs", "ms", "mx"]);

/**
 * The name we speak in empty states. "Erin has not added…", not "This person".
 * Titles and bare initials (B.L.) are skipped so the sentence still sounds like a name.
 */
export function givenName(fullName: string | null | undefined): string {
  const cleaned = String(fullName || "")
    .split(/\r?\n/)[0]
    .replace(/\([^)]*\)/g, " ")
    .replace(/["“”]/g, "")
    .trim();
  const parts = cleaned.split(/[\s,]+/).map((part) => part.trim()).filter(Boolean);
  const name = parts.find((part) => {
    const bare = part.replace(/\./g, "").toLowerCase();
    if (!bare || HONORIFICS.has(bare)) return false;
    if (/^([a-z]\.)+$/i.test(part)) return false;
    if (bare.length < 2) return false;
    return true;
  });
  return name?.replace(/\.$/, "") || cleaned || "They";
}

function hasNotAdded(fullName: string | null | undefined, thing: string): string {
  const name = givenName(fullName);
  if (name === "They") return `They haven't added ${thing} yet.`;
  return `${name} has not added ${thing} yet.`;
}

export function missingContactMessage(fullName: string | null | undefined): string {
  return hasNotAdded(fullName, "contact info");
}

export function missingLocationMessage(fullName: string | null | undefined): string {
  return hasNotAdded(fullName, "a map location");
}

export function missingDetailsMessage(fullName: string | null | undefined): string {
  return hasNotAdded(fullName, "project or bio details");
}
