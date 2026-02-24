/**
 * NodeSwitch — translucent pill toggle for hero placement.
 * Designed to sit on top of gradient backgrounds.
 */

import { NodeSlug } from "../../types/events";
import { NODES } from "../../data/nodes";
import { cn } from "../ui/utils";

interface NodeSwitchProps {
  activeNode: NodeSlug;
  onChange: (node: NodeSlug) => void;
}

export function NodeSwitch({ activeNode, onChange }: NodeSwitchProps) {
  return (
    <div
      className="inline-flex rounded-full bg-white/15 backdrop-blur-sm p-1 gap-0.5 border border-white/20"
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
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
              on
                ? "bg-white text-gray-900 shadow-sm"
                : "text-white/80 hover:text-white hover:bg-white/10",
            )}
          >
            {node.city}
          </button>
        );
      })}
    </div>
  );
}
