/**
 * Small helper for the "come back here after sign-in" flow.
 *
 * When a signed-out member taps a check-in QR code they land on
 * `/checkin/:nodeSlug`. Instead of bouncing them to the home screen after
 * they authenticate, we stash the intended path here and pop it off after
 * the next successful sign-in — so the member's experience is literally:
 *
 *   1. scan QR → /checkin/berlin (signed out)
 *   2. sign in (one tap, name is pre-filled)
 *   3. automatically land back at /checkin/berlin
 *   4. tap the check-in button → ◎ +1
 *
 * We use `sessionStorage` here (not `localStorage`) because this is a
 * navigation primitive — we only want it to survive the login detour, not
 * a browser-wide session.
 */

const RETURN_URL_KEY = "foresightmap_return_url";

/** Persist the URL the member should come back to after signing in. */
export function setPostLoginReturnUrl(pathAndQuery: string): void {
  try {
    if (!pathAndQuery || typeof pathAndQuery !== "string") return;
    sessionStorage.setItem(RETURN_URL_KEY, pathAndQuery);
  } catch {
    // sessionStorage can throw in some privacy modes; the redirect is a nicety, not a requirement.
  }
}

/** Read and clear the pending return URL in one atomic step. */
export function consumePostLoginReturnUrl(): string | null {
  try {
    const raw = sessionStorage.getItem(RETURN_URL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RETURN_URL_KEY);
    return raw;
  } catch {
    return null;
  }
}

export function clearPostLoginReturnUrl(): void {
  try {
    sessionStorage.removeItem(RETURN_URL_KEY);
  } catch {
    // ignore
  }
}
