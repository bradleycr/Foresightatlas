/**
 * Foresight physical nodes — the two hubs where programming happens.
 * Extend this array when new nodes come online.
 *
 * Colour palettes mirror the map sidebar's pastel-gradient language:
 *  • Berlin → deep violet → soft rose   (richer, European dusk)
 *  • SF     → warm amber  → open sky    (brighter, West-Coast noon)
 */

import { ForesightNode, NodeColorTheme, NodeSlug } from "../types/events";

const BERLIN_THEME: NodeColorTheme = {
  headerGradient: "linear-gradient(135deg, rgba(221,214,254,0.45) 0%, rgba(251,207,232,0.45) 100%)",

  monthSelected:      "bg-violet-100 border border-violet-200 text-violet-900 shadow-sm",
  monthSelectedLabel: "text-violet-700",
  monthSelectedCount: "text-violet-800",
  monthCurrent:       "bg-violet-50 border border-violet-200",
  monthCurrentLabel:  "text-violet-500",
  allUpcomingActive:  "bg-violet-100 text-violet-700",
  allUpcomingIdle:    "text-violet-600 hover:bg-violet-50",
  focusRing:          "focus-visible:ring-violet-500",

  avatarActiveBg:    "bg-violet-100",
  avatarActiveText:  "text-violet-700",
  triggerOpenBorder: "border-violet-300",
  triggerOpenRing:   "ring-violet-100",
  chevronActive:     "text-violet-500",
  searchFocusRing:   "focus-within:ring-violet-400",

  ctaBg:        "bg-violet-50",
  ctaText:      "text-violet-700",
  ctaBorder:    "border-violet-200",
  ctaHover:     "hover:bg-violet-100",
  ctaFocusRing: "focus:ring-violet-500",
  linkText:     "text-violet-600",
  linkHover:    "hover:text-violet-700",
};

const SF_THEME: NodeColorTheme = {
  headerGradient: "linear-gradient(135deg, rgba(254,243,199,0.55) 0%, rgba(191,219,254,0.55) 100%)",

  monthSelected:      "bg-sky-100 border border-sky-200 text-sky-900 shadow-sm",
  monthSelectedLabel: "text-sky-700",
  monthSelectedCount: "text-sky-800",
  monthCurrent:       "bg-sky-50 border border-sky-200",
  monthCurrentLabel:  "text-sky-500",
  allUpcomingActive:  "bg-sky-100 text-sky-700",
  allUpcomingIdle:    "text-sky-600 hover:bg-sky-50",
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

export const NODES: ForesightNode[] = [
  {
    slug: "berlin",
    name: "Berlin Node",
    city: "Berlin",
    country: "Germany",
    coordinates: { lat: 52.52, lng: 13.405 },
    timezone: "Europe/Berlin",
    description: "Foresight's European node.",
    gradient: "from-violet-500 to-pink-400",
    accent: "text-violet-600",
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
    gradient: "from-amber-400 to-sky-400",
    accent: "text-sky-600",
    theme: SF_THEME,
  },
];

export function getNode(slug: NodeSlug): ForesightNode | undefined {
  return NODES.find((n) => n.slug === slug);
}
