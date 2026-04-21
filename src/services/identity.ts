/**
 * Lightweight persisted member session for the profile directory.
 *
 * The backend signs the session token, while the client stores only the small
 * identity envelope it needs for navigation and optimistic UI state. Because
 * we rely on `localStorage`, the session survives every normal sign-out
 * scenario — closing the tab, quitting the browser, and rebooting the phone
 * all leave the session intact. The only things that clear it are:
 *
 *   • The user explicitly signing out.
 *   • The user clearing site data / cookies in their browser.
 *   • The browser's own privacy heuristics (e.g. iOS Safari ITP clearing
 *     `localStorage` after 7 days without a first-party interaction).
 *
 * For that last case the session-expiry window is 30 days on the server but
 * we proactively roll it forward (see {@link refreshDirectorySession}) any
 * time the app loads within a week of expiry, so returning members who open
 * the app even occasionally never have to sign in again. The paired
 * `lastSignedInName` slot below survives a full token clear so the login
 * screen can always pre-fill the member's name in one tap even if ITP wipes
 * the session token itself.
 */

const STORAGE_KEY = "foresightatlas_identity";
const LAST_NAME_KEY = "foresightatlas_last_signed_in_name";

/** Refresh the token whenever it has fewer than this many ms left. */
const REFRESH_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

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
  rememberLastSignedInName(identity.fullName);
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
  if (typeof updates.fullName === "string") {
    rememberLastSignedInName(updates.fullName);
  }
  return next;
}

export function clearIdentity(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * True when the stored `expiresAt` is already in the past. The server will
 * reject an expired token so we treat this as "signed out" locally too.
 */
export function isIdentityExpired(identity: Identity): boolean {
  const expiresAtMs = new Date(identity.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return true;
  return expiresAtMs <= Date.now();
}

/**
 * True when the token is still valid but approaching expiry — the boot
 * routine uses this to silently roll the session forward so active members
 * never hit the 30-day edge.
 */
export function shouldRefreshIdentity(
  identity: Identity,
  thresholdMs: number = REFRESH_THRESHOLD_MS,
): boolean {
  const expiresAtMs = new Date(identity.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return false;
  const timeLeft = expiresAtMs - Date.now();
  return timeLeft > 0 && timeLeft <= thresholdMs;
}

/**
 * Remember the last full name used on this device so the login form can
 * pre-fill it even if the signed token itself has been cleared (e.g. ITP
 * wiped localStorage after 7 inactive days, or the session expired). This
 * key is intentionally separate from {@link STORAGE_KEY} and is *not* a
 * security boundary — it only saves the member one tap on re-login.
 */
export function rememberLastSignedInName(fullName: string): void {
  const trimmed = (fullName || "").trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(LAST_NAME_KEY, trimmed);
  } catch {
    // Ignore storage failures (private mode, quota, etc.) — this is best-effort only.
  }
}

export function getLastSignedInName(): string | null {
  try {
    const raw = localStorage.getItem(LAST_NAME_KEY);
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function forgetLastSignedInName(): void {
  try {
    localStorage.removeItem(LAST_NAME_KEY);
  } catch {
    // ignore
  }
}
