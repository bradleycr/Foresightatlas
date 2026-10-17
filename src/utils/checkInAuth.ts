/**
 * Mailto helpers for access / password reset — admin mints magic links out-of-band.
 */

import { getProgrammingPageConfig } from "../data/nodes";
import type { NodeSlug } from "../types/events";

const SUPPORT_EMAIL = "bradley@foresight.org";

function mailto(subject: string, body: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const ATLAS_ACCESS_MAILTO = mailto(
  "Foresight Atlas access",
  "Hi,\n\nI'd like access to The Foresight Atlas.\n\nFull name on the directory:\n\nThanks",
);

/** Prefill a reset request so staff can mint a one-time sign-in link. */
export function atlasPasswordResetMailto(fullName?: string): string {
  const name = String(fullName || "").trim();
  const subject = name
    ? `Foresight Atlas password reset — ${name}`
    : "Foresight Atlas password reset";
  const body = name
    ? `Hi,\n\nPlease send me a new magic link to reset my Foresight Atlas password.\n\nFull name on the directory:\n${name}\n\nThanks`
    : "Hi,\n\nPlease send me a new magic link to reset my Foresight Atlas password.\n\nFull name on the directory:\n\nThanks";
  return mailto(subject, body);
}

/**
 * Light-touch bug report. Opens the member's own mail app with prompts for
 * what happened, when, and what they were doing — plus the page (and error,
 * when the app already knows it).
 */
export function atlasBugReportMailto(options?: { error?: string }): string {
  const page = typeof window !== "undefined" ? window.location.href : "";
  const when = new Date().toISOString();
  const error = String(options?.error || "").trim();
  const lines = [
    "Hi,",
    "",
    "What happened:",
    "",
    "",
    "When:",
    when,
    "",
    "What were you doing:",
    "",
    "",
  ];
  if (page) lines.push(`Page: ${page}`);
  if (error) lines.push(`Error: ${error.slice(0, 500)}`);
  return mailto("Foresight Atlas — bug report", lines.join("\n"));
}

/** Ask staff to wipe a roster row entirely (beyond the self-serve “hide from atlas” toggle). */
export function atlasProfileRemovalMailto(fullName?: string): string {
  const name = String(fullName || "").trim();
  const subject = name
    ? `Foresight Atlas — please remove my profile — ${name}`
    : "Foresight Atlas — please remove my profile";
  const body = name
    ? `Hi,\n\nPlease fully remove my profile from The Foresight Atlas (not just hide it):\n${name}\n\nThanks`
    : "Hi,\n\nPlease fully remove my profile from The Foresight Atlas (not just hide it).\n\nMy full directory name:\n\nThanks";
  return mailto(subject, body);
}

/** @deprecated Prefer {@link atlasPasswordResetMailto} so the body can include a name. */
export const ATLAS_PASSWORD_RESET_MAILTO = atlasPasswordResetMailto();

/** Parse `/checkin/:slug` (or bare `/checkin`) from the current route path. */
export function parseCheckInNodeSlug(route: string): NodeSlug | null {
  if (route === "/checkin" || route === "/checkin/berlin") return "berlin";
  if (route === "/checkin/sf") return "sf";
  if (route === "/checkin/global") return "global";
  return null;
}

export interface CheckInAuthCopy {
  nodeLabel: string;
  heroTitle: string;
  formTitle: string;
  submitLabel: string;
}

/** Contextual sign-in copy when someone lands from a node QR while signed out. */
export function getCheckInAuthCopy(route: string): CheckInAuthCopy | null {
  const slug = parseCheckInNodeSlug(route);
  if (!slug) return null;

  const node = getProgrammingPageConfig(slug);
  const nodeLabel = node?.name ?? (slug === "global" ? "Global programming" : slug);

  return {
    nodeLabel,
    heroTitle: `Check in at ${nodeLabel}`,
    formTitle: "Welcome back",
    submitLabel: "Sign in & check in",
  };
}

/** Normalise a check-in path for the post-login redirect stash. */
export function checkInReturnPath(route: string): string | null {
  const slug = parseCheckInNodeSlug(route);
  if (!slug) return null;
  return `/checkin/${slug}`;
}
