/**
 * Top-left projection switch: earth for the globe, map for the flat view.
 * On desktop it sits beside the zoom stack; on mobile zoom is gone and this
 * owns the corner alone, sized to mirror the List button on the right.
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
