/**
 * First-arrival letter.
 *
 * Armed once, for one person, when they enter the atlas: a first claim,
 * a join, a new profile, or a sign-in on this browser. Closing it is
 * remembered here, so it does not return on the next visit.
 *
 * Someone who already has the atlas open when this ships is treated as a
 * returning member and is not interrupted. If the letter was armed and they
 * closed the tab before reading it, it is still waiting the next time they
 * open the atlas.
 */

const SEEN_KEY = "foresightatlas_welcome_seen";
const PENDING_KEY = "foresightatlas_welcome_pending";

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

function hasSeenWelcome(personId: string): boolean {
  return readSeen().includes(personId);
}

function markWelcomeSeen(personId: string): void {
  if (!personId || hasSeenWelcome(personId)) return;
  try {
    const next = [...readSeen(), personId].slice(-200);
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    // Private mode can refuse the write. The letter may greet them once more.
  }
}

function readPending(): string | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Call once when the app boots.
 * A live session is someone already inside. Mark them seen unless their
 * letter is still waiting.
 */
export function noteExistingSession(personId: string | null): void {
  if (!personId) return;
  if (readPending() === personId) return;
  markWelcomeSeen(personId);
}

/** Queue the letter for this person. No-ops once they have closed it. */
export function armWelcomeLetter(personId: string): void {
  if (!personId || hasSeenWelcome(personId)) return;
  try {
    localStorage.setItem(PENDING_KEY, personId);
  } catch {
    // Private mode can refuse the write. The letter may not appear.
  }
}

export function welcomeLetterIsPending(personId: string): boolean {
  if (!personId || hasSeenWelcome(personId)) return false;
  return readPending() === personId;
}

export function dismissWelcomeLetter(personId: string): void {
  if (personId) markWelcomeSeen(personId);
  try {
    if (!personId || readPending() === personId) localStorage.removeItem(PENDING_KEY);
  } catch {
    // The seen flag is what keeps it closed.
  }
}
