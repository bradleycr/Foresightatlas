/**
 * Connection bookmarks — private to the signed-in member.
 *
 * Source of truth: Google Sheet tab `Connections` via `/api/connections`
 * (session-scoped). localStorage is a cache + offline buffer so the UI stays
 * snappy and old bookmarks survive until the first successful sync.
 *
 * Privacy: the API only ever returns the caller's own target IDs. Lists are
 * never merged into `/api/database` or shown to other members.
 */

import { getApiBase } from "./api-base";
import { getIdentity } from "./identity";
import { publishDataChanged, reportSyncError } from "./sync";

const STORAGE_PREFIX = "foresightatlas_connections_";
const MIGRATED_PREFIX = "foresightatlas_connections_migrated_";

/** In-memory mirror of the last successful GET /api/connections. */
let apiIdsByOwner: Record<string, string[]> = {};

function storageKey(personId: string): string {
  return `${STORAGE_PREFIX}${personId}`;
}

function migratedKey(personId: string): string {
  return `${MIGRATED_PREFIX}${personId}`;
}

function authHeaders(): HeadersInit {
  const identity = getIdentity();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (identity?.token) {
    headers.Authorization = `Bearer ${identity.token}`;
  }
  return headers;
}

function readLocal(personId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(personId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id: unknown) => typeof id === "string" && id.trim());
  } catch {
    return [];
  }
}

function writeLocal(personId: string, ids: string[]): void {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  localStorage.setItem(storageKey(personId), JSON.stringify(unique));
}

function mergeIds(...lists: string[][]): string[] {
  const out = new Set<string>();
  for (const list of lists) {
    for (const id of list) {
      if (id) out.add(id);
    }
  }
  return Array.from(out);
}

/** Sync read — memory + localStorage (for optimistic UI). */
export function getConnectionIds(userPersonId: string): string[] {
  if (!userPersonId) return [];
  return mergeIds(apiIdsByOwner[userPersonId] || [], readLocal(userPersonId));
}

export function isConnected(userPersonId: string, targetPersonId: string): boolean {
  return getConnectionIds(userPersonId).includes(targetPersonId);
}

/**
 * Pull the owner's bookmarks from the server. Migrates legacy local-only
 * bookmarks once when the server list is empty.
 */
export async function fetchConnectionsFromAPI(
  userPersonId?: string,
): Promise<string[] | null> {
  const identity = getIdentity();
  const ownerId = userPersonId || identity?.personId || "";
  if (!ownerId || !identity?.token) return null;

  try {
    const res = await fetch(`${getApiBase()}/connections`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      reportSyncError({
        scope: "connections",
        message: `GET /api/connections failed with ${res.status}`,
      });
      return null;
    }
    const body = (await res.json()) as { targetPersonIds?: string[] };
    let ids = Array.isArray(body.targetPersonIds) ? body.targetPersonIds : [];

    // One-time upload of pre-server local bookmarks.
    const alreadyMigrated = localStorage.getItem(migratedKey(ownerId)) === "1";
    const localIds = readLocal(ownerId);
    if (!alreadyMigrated && ids.length === 0 && localIds.length > 0) {
      for (const targetPersonId of localIds) {
        try {
          await postAction("add", targetPersonId);
        } catch {
          /* keep going — partial migrate is fine */
        }
      }
      localStorage.setItem(migratedKey(ownerId), "1");
      const again = await fetch(`${getApiBase()}/connections`, {
        headers: authHeaders(),
      });
      if (again.ok) {
        const againBody = (await again.json()) as { targetPersonIds?: string[] };
        ids = Array.isArray(againBody.targetPersonIds)
          ? againBody.targetPersonIds
          : ids;
      }
    } else if (!alreadyMigrated) {
      localStorage.setItem(migratedKey(ownerId), "1");
    }

    apiIdsByOwner[ownerId] = ids;
    writeLocal(ownerId, ids);
    return ids;
  } catch (err) {
    reportSyncError({
      scope: "connections",
      message:
        err instanceof Error && err.message
          ? err.message
          : "Could not reach the connections API.",
      cause: err,
    });
    return null;
  }
}

async function postAction(
  action: "add" | "remove",
  targetPersonId: string,
): Promise<string[]> {
  const res = await fetch(`${getApiBase()}/connections`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action, targetPersonId }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    targetPersonIds?: string[];
  };
  if (!res.ok) {
    throw new Error(body.error || `Connection ${action} failed (${res.status})`);
  }
  return Array.isArray(body.targetPersonIds) ? body.targetPersonIds : [];
}

async function mutate(
  userPersonId: string,
  targetPersonId: string,
  action: "add" | "remove",
): Promise<string[]> {
  // Optimistic local write so the bookmark toggles instantly.
  const current = getConnectionIds(userPersonId);
  const optimistic =
    action === "add"
      ? mergeIds(current, [targetPersonId])
      : current.filter((id) => id !== targetPersonId);
  writeLocal(userPersonId, optimistic);
  apiIdsByOwner[userPersonId] = optimistic;

  try {
    const ids = await postAction(action, targetPersonId);
    apiIdsByOwner[userPersonId] = ids;
    writeLocal(userPersonId, ids);
    publishDataChanged("connections", "write");
    return ids;
  } catch (err) {
    // Keep optimistic local state — will reconcile on next fetch.
    publishDataChanged("connections", "write");
    throw err;
  }
}

/** Add a person to the current user's connections. Idempotent. */
export async function addConnection(
  userPersonId: string,
  targetPersonId: string,
): Promise<void> {
  if (!userPersonId || !targetPersonId || userPersonId === targetPersonId) return;
  await mutate(userPersonId, targetPersonId, "add");
}

/** Remove a person from the current user's connections. Idempotent. */
export async function removeConnection(
  userPersonId: string,
  targetPersonId: string,
): Promise<void> {
  if (!userPersonId || !targetPersonId) return;
  await mutate(userPersonId, targetPersonId, "remove");
}

/** Toggle connection; returns new state (true = now connected). */
export async function toggleConnection(
  userPersonId: string,
  targetPersonId: string,
): Promise<boolean> {
  const connected = isConnected(userPersonId, targetPersonId);
  if (connected) {
    await removeConnection(userPersonId, targetPersonId);
    return false;
  }
  await addConnection(userPersonId, targetPersonId);
  return true;
}
