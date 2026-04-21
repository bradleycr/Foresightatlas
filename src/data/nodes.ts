/**
 * Foresight physical nodes — the two hubs where programming happens.
 * Extend this array when new nodes come online.
 *
 * Colour palettes mirror the map sidebar's pastel-gradient language:
 *  • Berlin → warm amber → open sky   (swapped: former SF palette)
 *  • SF     → indigo → soft rose      (swapped: former Berlin palette)
 */

import { ForesightNode, NodeColorTheme, NodeSlug } from "../types/events";

const BERLIN_THEME: NodeColorTheme = {
  headerGradient: "linear-gradient(135deg, rgba(254,243,199,0.55) 0%, rgba(191,219,254,0.55) 100%)",

  monthSelected:      "bg-gradient-to-br from-sky-100 to-amber-100 border border-sky-200 text-sky-900 shadow-sm",
  monthSelectedLabel: "text-sky-700",
  monthSelectedCount: "text-sky-800",
  monthCurrent:       "bg-gradient-to-br from-sky-50 to-amber-50 border border-sky-200",
  monthCurrentLabel:  "text-sky-500",
  allUpcomingActive:  "bg-gradient-to-r from-sky-100 to-amber-100 text-sky-700",
  allUpcomingIdle:    "text-sky-600 hover:bg-gradient-to-r hover:from-sky-50 hover:to-amber-50",
  focusRing:          "focus-visible:ring-sky-500",

  avatarActiveBg:    "bg-sky-100",
  avatarActiveText:  "text-sky-700",
  triggerOpenBorder: "border-sky-300",
  triggerOpenRing:   "ring-sky-100",
  chevronActive:     "text-sky-500",
  searchFocusRing:   "focus-within:ring-sky-400",

  ctaBg:        "bg-sky-50",
  ctaText:      "text-sky-700",
  ctaBorder:    "border-sky-200",
  ctaHover:     "hover:bg-sky-100",
  ctaFocusRing: "focus:ring-sky-500",
  linkText:     "text-sky-600",
  linkHover:    "hover:text-sky-700",
};

const SF_THEME: NodeColorTheme = {
  headerGradient: "linear-gradient(135deg, rgba(224,231,255,0.5) 0%, rgba(251,207,232,0.45) 100%)",

  monthSelected:      "bg-gradient-to-br from-indigo-100 to-rose-100 border border-indigo-200 text-indigo-900 shadow-sm",
  monthSelectedLabel: "text-indigo-700",
  monthSelectedCount: "text-indigo-800",
  monthCurrent:       "bg-gradient-to-br from-indigo-50 to-rose-50 border border-indigo-200",
  monthCurrentLabel:  "text-indigo-500",
  allUpcomingActive:  "bg-gradient-to-r from-indigo-100 to-rose-100 text-indigo-700",
  allUpcomingIdle:    "text-indigo-600 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-rose-50",
  focusRing:          "focus-visible:ring-indigo-500",

  avatarActiveBg:    "bg-indigo-100",
  avatarActiveText:  "text-indigo-700",
  triggerOpenBorder: "border-indigo-300",
  triggerOpenRing:   "ring-indigo-100",
  chevronActive:     "text-indigo-500",
  searchFocusRing:   "focus-within:ring-indigo-400",

  ctaBg:        "bg-indigo-50",
  ctaText:      "text-indigo-700",
  ctaBorder:    "border-indigo-200",
  ctaHover:     "hover:bg-indigo-100",
  ctaFocusRing: "focus:ring-indigo-500",
  linkText:     "text-indigo-600",
  linkHover:    "hover:text-indigo-700",
};

export const NODES: ForesightNode[] = [
  {
    slug: "berlin",
    name: "Berlin Node",
    city: "Berlin",
    country: "Germany",
    coordinates: { lat: 52.52, lng: 13.405 },
    timezone: "Europe/Berlin",
    description: "Foresight's European node.",
    gradient: "from-amber-400 to-sky-400",
    accent: "text-sky-600",
    theme: BERLIN_THEME,
  },
  {
    slug: "sf",
    name: "San Francisco Node",
    city: "San Francisco",
    country: "United States",
    coordinates: { lat: 37.7749, lng: -122.4194 },
    timezone: "America/Los_Angeles",
    description: "Foresight's Bay Area node.",
    gradient: "from-indigo-500 to-pink-400",
    accent: "text-indigo-600",
    theme: SF_THEME,
  },
];

/** Theme for the Global programming page (events not tied to a single node). */
const GLOBAL_THEME: NodeColorTheme = {
  headerGradient: "linear-gradient(135deg, rgba(236,254,255,0.6) 0%, rgba(224,242,254,0.5) 100%)",

  monthSelected:      "bg-gradient-to-br from-teal-100 to-cyan-100 border border-teal-200 text-teal-900 shadow-sm",
  monthSelectedLabel:  "text-teal-700",
  monthSelectedCount: "text-teal-800",
  monthCurrent:        "bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200",
  monthCurrentLabel:   "text-teal-500",
  allUpcomingActive:   "bg-gradient-to-r from-teal-100 to-cyan-100 text-teal-700",
  allUpcomingIdle:     "text-teal-600 hover:bg-gradient-to-r hover:from-teal-50 hover:to-cyan-50",
  focusRing:           "focus-visible:ring-teal-500",

  avatarActiveBg:    "bg-teal-100",
  avatarActiveText:  "text-teal-700",
  triggerOpenBorder: "border-teal-300",
  triggerOpenRing:   "ring-teal-100",
  chevronActive:     "text-teal-500",
  searchFocusRing:   "focus-within:ring-teal-400",

  ctaBg:        "bg-teal-50",
  ctaText:      "text-teal-700",
  ctaBorder:    "border-teal-200",
  ctaHover:     "hover:bg-teal-100",
  ctaFocusRing: "focus:ring-teal-500",
  linkText:     "text-teal-600",
  linkHover:    "hover:text-teal-700",
};

/** Config for a programming page (physical node or global). */
export type ProgrammingPageConfig = ForesightNode | {
  slug: "global";
  city: string;
  description: string;
  theme: NodeColorTheme;
};

export function getNode(slug: NodeSlug): ForesightNode | undefined {
  return NODES.find((n) => n.slug === slug);
}

/** Resolve config for a programming page; supports global (no physical node). */
export function getProgrammingPageConfig(slug: NodeSlug): ProgrammingPageConfig | undefined {
  if (slug === "global") {
    return {
      slug: "global",
      city: "Global",
      description: "Foresight's global and non-node-specific events.",
      theme: GLOBAL_THEME,
    };
  }
  return getNode(slug);
}
