/**
 * Profile photo URL resolution for map cards and modals.
 *
 * The Google Sheet is the source of truth. Legacy per-browser overrides in
 * localStorage are only used when the sheet has no image yet.
 */

import type { Person } from "../types";

const STORAGE_PREFIX = "foresightatlas_profileImageUrl_";

export function getProfileImageOverride(personId: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_PREFIX + personId)?.trim();
  return raw || null;
}

/** @deprecated Sheet is canonical — clear overrides after a successful profile save. */
export function setProfileImageOverride(personId: string, url: string | null): void {
  if (typeof window === "undefined") return;
  const key = STORAGE_PREFIX + personId;
  const trimmed = url?.trim();
  if (trimmed) localStorage.setItem(key, trimmed);
  else localStorage.removeItem(key);
}

export function clearProfileImageOverride(personId: string): void {
  setProfileImageOverride(personId, null);
}

/** Sheet URL first; legacy browser override only when the sheet is empty. */
export function getEffectiveProfileImageUrl(person: Person): string | null {
  const fromSheet = person.profileImageUrl?.trim();
  if (fromSheet) return fromSheet;
  return getProfileImageOverride(person.id);
}
