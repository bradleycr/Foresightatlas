/**
 * Focus neighbors — compact suggestions of people who share focus areas.
 * Shown on person profiles as a second-layer discovery signal.
 */

import { Sparkles } from "lucide-react";
import type { Person } from "../types";
import { findFocusNeighbors } from "../utils/focusNeighbors";
import { getEffectiveProfileImageUrl } from "../services/profileImageOverride";
import { PersonAvatar } from "./PersonAvatar";
import { cn } from "./ui/utils";

interface FocusNeighborsProps {
  person: Person;
  /** Full directory (not just the filtered map slice). */
  directory: Person[];
  onPersonClick?: (personId: string) => void;
  className?: string;
}

export function FocusNeighbors({
  person,
  directory,
  onPersonClick,
  className,
}: FocusNeighborsProps) {
  const neighbors = findFocusNeighbors(person, directory, 6);
  if (neighbors.length === 0) return null;

  return (
    <section
      className={cn("person-detail-section mt-6 lg:mt-8 person-detail-divider", className)}
      aria-label="Focus neighbors"
    >
      <h3 className="person-detail-section-title flex items-center gap-2 mb-3">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        Focus neighbors
      </h3>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">
        People in the Atlas who share focus areas with {person.fullName.split(" ")[0] || "them"}.
      </p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {neighbors.map(({ person: n, sharedTags }) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onPersonClick?.(n.id)}
              disabled={!onPersonClick}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5 text-left",
                "transition-colors",
                onPersonClick
                  ? "hover:bg-teal-50/80 hover:border-teal-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 cursor-pointer"
                  : "cursor-default",
              )}
            >
              <PersonAvatar
                name={n.fullName}
                src={getEffectiveProfileImageUrl(n)}
                className="size-9 shrink-0 rounded-full"
                textClassName="text-[10px]"
                loading="lazy"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-900 truncate">
                  {n.fullName}
                </span>
                <span className="block text-[11px] text-gray-500 truncate">
                  {sharedTags.slice(0, 2).join(" · ")}
                  {sharedTags.length > 2 ? ` +${sharedTags.length - 2}` : ""}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
