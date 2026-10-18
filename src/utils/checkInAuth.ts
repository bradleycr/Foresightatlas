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

export interface BugReportDraft {
  to: string;
  subject: string;
  body: string;
}

/**
 * Shared bug-report copy — page URL, timestamp, and optional known error —
 * so every compose path (Gmail, Outlook, mailto) stays in sync.
 */
export function buildBugReportDraft(options?: { error?: string }): BugReportDraft {
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
  return {
    to: SUPPORT_EMAIL,
    subject: "Foresight Atlas — bug report",
    body: lines.join("\n"),
  };
}

/** Native mail handler. Prefer web compose URLs when no desktop client is set. */
export function atlasBugReportMailto(options?: { error?: string }): string {
  const draft = buildBugReportDraft(options);
  return mailto(draft.subject, draft.body);
}

/**
 * Browser compose links for a desktop session that is already signed in.
 * Phones should not use these — mobile Gmail ignores the compose params and
 * lands on a random inbox.
 */
export function atlasBugReportComposeUrls(options?: { error?: string }): {
  mailto: string;
  gmail: string;
  outlook: string;
} {
  const draft = buildBugReportDraft(options);
  const to = encodeURIComponent(draft.to);
  const subject = encodeURIComponent(draft.subject);
  const body = encodeURIComponent(draft.body);
  return {
    mailto: mailto(draft.subject, draft.body),
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`,
    outlook: `https://outlook.office.com/mail/deeplink/compose?to=${to}&subject=${subject}&body=${body}`,
  };
}

/** A phone browser, where webmail compose links do not open a draft. */
export function isPhoneBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * Open a drafted bug report in the right place.
 * Phones use the app's own URL scheme (Gmail / Outlook) or mailto, which the
 * system routes to the installed mail app. Desktop keeps the web compose tab.
 */
export function openBugReportCompose(
  kind: "gmail" | "outlook" | "mailto",
  options?: { error?: string },
) {
  const urls = atlasBugReportComposeUrls(options);
  if (kind === "mailto") {
    window.location.href = urls.mailto;
    return;
  }
  if (!isPhoneBrowser()) {
    window.open(urls[kind], "_blank", "noopener,noreferrer");
    return;
  }
  const draft = buildBugReportDraft(options);
  const query = `to=${encodeURIComponent(draft.to)}&subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
  // Three slashes: Gmail's compose endpoint is `co` on an empty host.
  const native =
    kind === "gmail" ? `googlegmail:///co?${query}` : `ms-outlook://compose?${query}`;
  window.location.href = native;
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
