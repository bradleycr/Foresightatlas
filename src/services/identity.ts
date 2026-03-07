/**
 * Lightweight persisted member session for the profile directory.
 *
 * The backend now signs the session token, while the client stores only the
 * small identity envelope it needs for navigation and optimistic UI state.
 */

const STORAGE_KEY = "foresightmap_identity";

export interface Identity {
  personId: string;
  fullName: string;
  token: string;
  expiresAt: string;
  mustChangePassword: boolean;
  selectedAt: string; // ISO timestamp
}

export function getIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    if (
      !parsed ||
      typeof parsed.personId !== "string" ||
      typeof parsed.fullName !== "string" ||
      typeof parsed.token !== "string" ||
      typeof parsed.expiresAt !== "string"
    ) {
      return null;
    }

    return {
      personId: parsed.personId,
      fullName: parsed.fullName,
      token: parsed.token,
      expiresAt: parsed.expiresAt,
      mustChangePassword: Boolean(parsed.mustChangePassword),
      selectedAt:
        typeof parsed.selectedAt === "string"
          ? parsed.selectedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function setIdentity(
  value: Omit<Identity, "selectedAt"> & { selectedAt?: string },
): void {
  const identity: Identity = {
    personId: value.personId,
    fullName: value.fullName,
    token: value.token,
    expiresAt: value.expiresAt,
    mustChangePassword: value.mustChangePassword,
    selectedAt: value.selectedAt ?? new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export function updateIdentity(
  updates: Partial<Omit<Identity, "selectedAt">>,
): Identity | null {
  const current = getIdentity();
  if (!current) return null;

  const next: Identity = {
    ...current,
    ...updates,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearIdentity(): void {
  localStorage.removeItem(STORAGE_KEY);
}
