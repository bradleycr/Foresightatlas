/**
 * Minimal pin-color key — circles match ROLE_COLORS on the map.
 * Mobile: bottom-left. Desktop: mid-left (standard map-legend pocket).
 */

import { ROLE_COLORS, getRoleGradient } from "../../styles/roleColors";
import { Z_INDEX_MAP_CONTROLS } from "../../constants/zIndex";
import type { RoleType } from "../../types";
import { cn } from "../ui/utils";

const LEGEND_ROLES: Array<{ role: RoleType; label: string }> = [
  { role: "Fellow", label: "Fellow" },
  { role: "Senior Fellow", label: "Senior Fellow" },
  { role: "Grantee", label: "Grantee" },
  { role: "Prize Winner", label: "Prize Winner" },
  { role: "Nodee", label: "Nodee" },
  { role: "Foresight Team", label: "Team" },
];

interface MapRoleLegendProps {
  /** Public globe sits on a dark sky — light text. Logged-in map uses light. */
  tone?: "light" | "dark";
  /**
   * Extra bottom clearance (e.g. public showcase zoom stack at bottom-left).
   * Mobile only; desktop stays mid-left.
   */
  mobileBottomClassName?: string;
  className?: string;
}

export function MapRoleLegend({
  tone = "light",
  mobileBottomClassName = "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
  className,
}: MapRoleLegendProps) {
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-3",
        mobileBottomClassName,
        "md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-3",
        className,
      )}
      style={{ zIndex: Z_INDEX_MAP_CONTROLS }}
      role="list"
      aria-label="Map pin colors by role"
    >
      <ul
        className={cn(
          "flex flex-col gap-1 rounded-xl px-2.5 py-2 shadow-sm ring-1 backdrop-blur-md",
          dark
            ? "bg-black/45 text-white ring-white/15"
            : "bg-white/92 text-gray-800 ring-black/8",
        )}
      >
        {LEGEND_ROLES.map(({ role, label }) => (
          <li key={role} className="flex items-center gap-2" role="listitem">
            <span
              className="size-2.5 shrink-0 rounded-full shadow-sm ring-1 ring-black/10"
              style={{
                background: getRoleGradient(role),
                boxShadow: `inset 0 0 0 1px ${ROLE_COLORS[role].solid}55`,
              }}
              aria-hidden
            />
            <span className="text-[11px] font-medium leading-none tracking-tight">
              {label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
