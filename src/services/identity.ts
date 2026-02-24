/**
 * Lightweight identity layer — internal members pick their name from
 * the people directory to unlock RSVP. Persists in localStorage.
 *
 * Swap with NextAuth / Clerk when the app moves to a server-backed
 * architecture. The interface is intentionally minimal so the
 * migration surface is tiny.
 */

const STORAGE_KEY = "foresightmap_identity";

export interface Identity {
  personId: string;
  fullName: string;
  selectedAt: string; // ISO timestamp
}

export function getIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

export function setIdentity(personId: string, fullName: string): void {
  const identity: Identity = {
    personId,
    fullName,
    selectedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export function clearIdentity(): void {
  localStorage.removeItem(STORAGE_KEY);
}
