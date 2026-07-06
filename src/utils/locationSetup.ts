/**
 * Post-onboarding location setup — nudge members to add a city so they get a
 * map pin. Triggered after claim / first sign-in when currentCity is blank.
 */

import type { Person } from "../types";

const SETUP_QUERY = "setup=location";
const DISMISS_KEY = "foresightatlas_location_setup_dismissed";

export function personNeedsLocation(person: Person | null | undefined): boolean {
  if (!person) return false;
  if (person.isPrivate) return false;
  return !String(person.currentCity || "").trim();
}

export function isLocationSetupUrl(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("setup") === "location";
  } catch {
    return false;
  }
}

export function profileLocationSetupPath(): string {
  return `/profile?${SETUP_QUERY}`;
}

/** Remove ?setup=location from the address bar without a full navigation. */
export function clearLocationSetupUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("setup")) return;
    url.searchParams.delete("setup");
    const next = url.pathname + url.search + url.hash;
    window.history.replaceState({}, "", next);
  } catch {
    // ignore
  }
}

export function dismissLocationSetupForSession(personId: string): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, personId);
  } catch {
    // ignore
  }
}

export function isLocationSetupDismissed(personId: string): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === personId;
  } catch {
    return false;
  }
}

export function clearLocationSetupDismissed(): void {
  try {
    sessionStorage.removeItem(DISMISS_KEY);
  } catch {
    // ignore
  }
}

/**
 * Whether to show the “set your city” onboarding prompt on the profile page.
 */
export function shouldShowLocationSetup(
  person: Person | null | undefined,
  options: { fromClaimUrl?: boolean } = {},
): boolean {
  if (!personNeedsLocation(person) || !person) return false;
  if (options.fromClaimUrl || isLocationSetupUrl()) return true;
  if (isLocationSetupDismissed(person.id)) return false;
  return true;
}
