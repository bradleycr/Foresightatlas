/**
 * Foresight physical nodes — the two hubs where programming happens.
 * Extend this array when new nodes come online.
 */

import { ForesightNode, NodeSlug } from "../types/events";

export const NODES: ForesightNode[] = [
  {
    slug: "berlin",
    name: "Berlin Node",
    city: "Berlin",
    country: "Germany",
    coordinates: { lat: 52.52, lng: 13.405 },
    timezone: "Europe/Berlin",
    description:
      "Foresight's European hub — residencies, workshops, and collab sessions at the heart of Berlin's science & deep-tech scene.",
    gradient: "from-blue-600 to-indigo-600",
    accent: "text-blue-600",
  },
  {
    slug: "sf",
    name: "San Francisco Node",
    city: "San Francisco",
    country: "United States",
    coordinates: { lat: 37.7749, lng: -122.4194 },
    timezone: "America/Los_Angeles",
    description:
      "Foresight's Bay Area hub — demo days, deep dives, and community gatherings where Silicon Valley meets frontier science.",
    gradient: "from-amber-500 to-orange-500",
    accent: "text-amber-600",
  },
];

export function getNode(slug: NodeSlug): ForesightNode | undefined {
  return NODES.find((n) => n.slug === slug);
}
