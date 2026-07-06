import { getProgrammingPageConfig } from "../data/nodes";
import type { NodeSlug } from "../types/events";

const SUPPORT_EMAIL = "bradley@foresight.org";

export const ATLAS_PASSWORD_RESET_MAILTO =
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Foresight Atlas password reset")}`;

export const ATLAS_ACCESS_MAILTO =
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Foresight Atlas access")}`;

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
  heroSubtitle: string;
  formTitle: string;
  formDescription: string;
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
    heroSubtitle:
      "Sign in with the name and password from your claim link. You'll come right back here to mark yourself at the node today.",
    formTitle: "Sign in to check in",
    formDescription:
      "Use your full directory name and password. First time on this phone? Sign in once — we'll remember you for next time.",
    submitLabel: "Sign in & check in",
  };
}

/** Normalise a check-in path for the post-login redirect stash. */
export function checkInReturnPath(route: string): string | null {
  const slug = parseCheckInNodeSlug(route);
  if (!slug) return null;
  return `/checkin/${slug}`;
}
