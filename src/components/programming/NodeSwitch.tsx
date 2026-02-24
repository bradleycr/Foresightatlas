/**
 * Pill-shaped toggle to switch the active node (Berlin / SF).
 * Mirrors a tab-bar pattern with keyboard support.
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
      className="inline-flex rounded-xl bg-gray-100 p-1 gap-1"
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
              "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
              on
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-500 hover:text-gray-700 hover:bg-white/50",
            )}
          >
            {node.city}
          </button>
        );
      })}
    </div>
  );
}
