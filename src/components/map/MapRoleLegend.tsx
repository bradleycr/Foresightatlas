/**
 * Minimal pin-color key — Fellow, Grantee, Nodee, Team.
 * Pastel dots use the same gradients as map pin badges.
 * Bottom-left everywhere; sits above the zoom stack when logged in.
 */

import type { CSSProperties } from "react";
import { getRoleGradient } from "../../styles/roleColors";
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
   * `app` clears the bottom-left zoom + projection stack.
   * `public` has no corner zoom — just safe-area inset.
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
        surface === "app"
          ? "bottom-[5.75rem]"
          : "bottom-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
      style={{ zIndex: Z_INDEX_MAP_CONTROLS } satisfies CSSProperties}
      role="list"
      aria-label="Map pin colors by role"
    >
      <ul
        className={cn(
          "flex flex-col gap-1.5 rounded-xl px-2.5 py-2.5 shadow-[0_8px_28px_-12px_rgba(0,0,0,0.35)] ring-1 backdrop-blur-xl",
          dark
            ? "bg-white/12 text-white ring-white/25"
            : "bg-white/55 text-gray-800 ring-white/50",
        )}
      >
        {LEGEND_ROLES.map(({ role, label }) => (
          <li key={role} className="flex items-center gap-2" role="listitem">
            <span
              className={cn(
                "size-3.5 shrink-0 rounded-full shadow-sm ring-1",
                dark ? "ring-white/30" : "ring-black/10",
              )}
              style={{ background: getRoleGradient(role) }}
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
