/**
 * The globe is an alternate camera on the same OpenStreetMap tiles.
 * The Leaflet map underneath is unchanged.
 *
 * Set this to false to remove the globe, hide the toggle, and leave
 * only the original flat map. No other cleanup is required.
 */
export const GLOBE_MAP_ENABLED = true;

const STORAGE_KEY = "atlas-map-projection";

export type MapProjection = "globe" | "flat";

/** First visit opens on the globe. A later choice is remembered on this device. */
export function readMapProjection(): MapProjection {
  if (!GLOBE_MAP_ENABLED) return "flat";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "flat" || stored === "globe") return stored;
  } catch {
    /* Private mode and blocked storage both fall through to the globe. */
  }
  return "globe";
}

export function writeMapProjection(projection: MapProjection): void {
  try {
    localStorage.setItem(STORAGE_KEY, projection);
  } catch {
    /* Remembering the choice is a convenience, not a requirement. */
  }
}

/** MapLibre paints with WebGL. Without it we stay on the Leaflet map. */
export function supportsWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
