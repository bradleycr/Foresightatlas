/**
 * Optional profile photo URL stored only in the browser (localStorage).
 * Lets a member paste an image URL for how they appear on the map and in
 * modals on this device, without writing to the Google Sheet.
 */

import type { Person } from "../types";

const STORAGE_PREFIX = "foresight_profileImageUrl_";

export function getProfileImageOverride(personId: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_PREFIX + personId)?.trim();
  return raw || null;
}

export function setProfileImageOverride(personId: string, url: string | null): void {
  if (typeof window === "undefined") return;
  const key = STORAGE_PREFIX + personId;
  const trimmed = url?.trim();
  if (trimmed) localStorage.setItem(key, trimmed);
  else localStorage.removeItem(key);
}

/** Sheet URL plus optional per-device override (override wins when set). */
export function getEffectiveProfileImageUrl(person: Person): string | null {
  const override = getProfileImageOverride(person.id);
  if (override) return override;
  const fromSheet = person.profileImageUrl?.trim();
  return fromSheet || null;
}
