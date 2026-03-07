/**
 * Foresight physical nodes — the two hubs where programming happens.
 * Extend this array when new nodes come online.
 *
 * Colour palettes mirror the map sidebar's pastel-gradient language:
 *  • Berlin → indigo → soft rose   (softer, European dusk — no strong purple)
 *  • SF     → warm amber  → open sky    (brighter, West-Coast noon)
 */

import { ForesightNode, NodeColorTheme, NodeSlug } from "../types/events";

const BERLIN_THEME: NodeColorTheme = {
  headerGradient: "linear-gradient(135deg, rgba(224,231,255,0.5) 0%, rgba(251,207,232,0.45) 100%)",

  monthSelected:      "bg-indigo-100 border border-indigo-200 text-indigo-900 shadow-sm",
  monthSelectedLabel: "text-indigo-700",
  monthSelectedCount: "text-indigo-800",
  monthCurrent:       "bg-indigo-50 border border-indigo-200",
  monthCurrentLabel:  "text-indigo-500",
  allUpcomingActive:  "bg-indigo-100 text-indigo-700",
  allUpcomingIdle:    "text-indigo-600 hover:bg-indigo-50",
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
    gradient: "from-indigo-500 to-pink-400",
    accent: "text-indigo-600",
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
