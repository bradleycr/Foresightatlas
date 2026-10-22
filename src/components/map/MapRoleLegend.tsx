/**
 * Minimal pin-color key — main roles only (Fellow, Grantee, Nodee, Team).
 * Mobile: top-left (clear of bottom chrome). Desktop: bottom-left.
 */

import type { CSSProperties } from "react";
import { ROLE_COLORS } from "../../styles/roleColors";
import { Z_INDEX_MAP_CONTROLS } from "../../constants/zIndex";
import type { RoleType } from "../../types";
import { cn } from "../ui/utils";

const LEGEND_ROLES: Array<{ role: RoleType; label: string }> = [
  { role: "Fellow", label: "Fellow" },
  { role: "Grantee", label: "Grantee" },
  { role: "Nodee", label: "Nodee" },
  { role: "Foresight Team", label: "Team" },
];

interface MapRoleLegendProps {
  /** Public globe sits on a dark sky — light text. Logged-in map uses light. */
  tone?: "light" | "dark";
  /**
   * `public` sits under the brand header on mobile.
   * `app` (logged-in) uses a tighter top inset — zoom lives bottom-left.
   */
  surface?: "app" | "public";
  className?: string;
}

export function MapRoleLegend({
  tone = "light",
  surface = "app",
  className,
}: MapRoleLegendProps) {
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-3",
        /* Mobile: top-left, clear of header / safe area */
        surface === "public"
          ? "top-[max(4.25rem,calc(env(safe-area-inset-top)+3.5rem))]"
          : "top-[max(0.75rem,env(safe-area-inset-top))]",
        /*
         * Desktop: bottom-left. Logged-in sits above the zoom + projection
         * stack; public has no corner zoom so it can sit lower.
         */
        surface === "app"
          ? "md:top-auto md:bottom-[5.75rem]"
          : "md:top-auto md:bottom-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
      style={{ zIndex: Z_INDEX_MAP_CONTROLS } satisfies CSSProperties}
      role="list"
      aria-label="Map pin colors by role"
    >
      <ul
        className={cn(
          "flex flex-col gap-1.5 rounded-xl px-2.5 py-2.5 shadow-sm ring-1 backdrop-blur-md",
          dark
            ? "bg-black/45 text-white ring-white/15"
            : "bg-white/92 text-gray-800 ring-black/8",
        )}
      >
        {LEGEND_ROLES.map(({ role, label }) => (
          <li key={role} className="flex items-center gap-2" role="listitem">
            <span
              className={cn(
                "size-3.5 shrink-0 rounded-full ring-1",
                dark ? "ring-white/25" : "ring-black/15",
              )}
              style={{ background: ROLE_COLORS[role].solid }}
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
