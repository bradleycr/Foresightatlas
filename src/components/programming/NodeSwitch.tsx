/**
 * NodeSwitch — pill toggle for node selection.
 * Light variant matches app header (teal/gray); dark variant for gradient heroes.
 */

import { NodeSlug } from "../../types/events";
import { NODES } from "../../data/nodes";
import { cn } from "../ui/utils";

interface NodeSwitchProps {
  activeNode: NodeSlug;
  onChange: (node: NodeSlug) => void;
  /** "light" = on white/gray header (default); "dark" = on gradient hero */
  variant?: "light" | "dark";
}

export function NodeSwitch({ activeNode, onChange, variant = "light" }: NodeSwitchProps) {
  const isLight = variant === "light";

  return (
    <div
      className={cn(
        "inline-flex rounded-full p-1 gap-0.5 border",
        isLight
          ? "bg-gray-50 border-gray-200"
          : "bg-white/15 backdrop-blur-sm border-white/20",
      )}
      role="tablist"
    >
      {NODES.map((node) => {
        const on = node.slug === activeNode;
        return (
          <button
            key={node.slug}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(node.slug)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
              isLight
                ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1"
                : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
              on && isLight && "bg-teal-100 text-teal-800 shadow-sm border border-teal-200/80",
              on && !isLight && "bg-white text-gray-900 shadow-sm",
              !on && isLight && "text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent",
              !on && !isLight && "text-white/80 hover:text-white hover:bg-white/10",
            )}
          >
            {node.city}
          </button>
        );
      })}
    </div>
  );
}
