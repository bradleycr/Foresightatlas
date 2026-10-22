/**
 * Sits beside the zoom stack on the top left of the map.
 * Two marks, no words: the earth for the globe, a map for the flat view.
 * Globe is the opening view. Flat is the original Leaflet map.
 */

import { Globe, Map } from "lucide-react";
import { MapProjection } from "./globeMapFlag";
import { Z_INDEX_MAP_CONTROLS } from "../../constants/zIndex";

interface MapProjectionToggleProps {
  mode: MapProjection;
  onChange: (mode: MapProjection) => void;
}

export function MapProjectionToggle({ mode, onChange }: MapProjectionToggleProps) {
  return (
    <div
      className="atlas-projection-toggle"
      role="group"
      aria-label="Map projection"
      style={{ zIndex: Z_INDEX_MAP_CONTROLS }}
    >
      <button
        type="button"
        className={mode === "globe" ? "is-active" : undefined}
        aria-pressed={mode === "globe"}
        aria-label="Globe"
        title="Globe"
        onClick={() => onChange("globe")}
      >
        <Globe aria-hidden />
      </button>
      <button
        type="button"
        className={mode === "flat" ? "is-active" : undefined}
        aria-pressed={mode === "flat"}
        aria-label="Flat map"
        title="Flat map"
        onClick={() => onChange("flat")}
      >
        <Map aria-hidden />
      </button>
    </div>
  );
}
