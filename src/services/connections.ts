/**
 * Connections (bookmarks) service
 *
 * Persists which people the logged-in user has "bookmarked" for easy reconnection.
 * Stored in localStorage, keyed by the current user's personId so each account
 * has its own list. No server round-trip — purely client-side for now.
 */

const STORAGE_PREFIX = "foresightmap_connections_";

function storageKey(personId: string): string {
  return `${STORAGE_PREFIX}${personId}`;
}

/** Returns the set of person IDs the given user has bookmarked. */
export function getConnectionIds(userPersonId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(userPersonId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id: unknown) => typeof id === "string");
  } catch {
    return [];
  }
}

/** Add a person to the current user's connections. Idempotent. */
export function addConnection(userPersonId: string, targetPersonId: string): void {
  const ids = getConnectionIds(userPersonId);
  if (ids.includes(targetPersonId)) return;
  localStorage.setItem(storageKey(userPersonId), JSON.stringify([...ids, targetPersonId]));
}

/** Remove a person from the current user's connections. Idempotent. */
export function removeConnection(userPersonId: string, targetPersonId: string): void {
  const ids = getConnectionIds(userPersonId).filter((id) => id !== targetPersonId);
  localStorage.setItem(storageKey(userPersonId), JSON.stringify(ids));
}

/** True if the user has bookmarked this person. */
export function isConnected(userPersonId: string, targetPersonId: string): boolean {
  return getConnectionIds(userPersonId).includes(targetPersonId);
}

/** Toggle connection; returns new state (true = now connected). */
export function toggleConnection(userPersonId: string, targetPersonId: string): boolean {
  const connected = isConnected(userPersonId, targetPersonId);
  if (connected) {
    removeConnection(userPersonId, targetPersonId);
    return false;
  }
  addConnection(userPersonId, targetPersonId);
  return true;
}
