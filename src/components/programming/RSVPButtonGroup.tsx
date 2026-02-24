/**
 * Three-state RSVP toggle: Going · Interested · Can't go.
 * Tapping the active status deselects it (returns null).
 * Counts are shown inline when available.
 */

import { Check, Star, Minus } from "lucide-react";
import { RSVPStatus } from "../../types/events";
import { cn } from "../ui/utils";

interface RSVPButtonGroupProps {
  currentStatus: RSVPStatus | null;
  onStatusChange: (status: RSVPStatus | null) => void;
  disabled?: boolean;
  goingCount?: number;
  interestedCount?: number;
}

const CHOICES: {
  status: RSVPStatus;
  label: string;
  Icon: typeof Check;
  active: string;
  hover: string;
}[] = [
  {
    status: "going",
    label: "Going",
    Icon: Check,
    active: "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm",
    hover:
      "hover:bg-emerald-50/60 hover:border-emerald-200 hover:text-emerald-700",
  },
  {
    status: "interested",
    label: "Interested",
    Icon: Star,
    active: "bg-amber-50 border-amber-300 text-amber-700 shadow-sm",
    hover:
      "hover:bg-amber-50/60 hover:border-amber-200 hover:text-amber-700",
  },
  {
    status: "not-going",
    label: "Can't go",
    Icon: Minus,
    active: "bg-gray-100 border-gray-300 text-gray-600 shadow-sm",
    hover: "hover:bg-gray-50 hover:border-gray-300 hover:text-gray-600",
  },
];

export function RSVPButtonGroup({
  currentStatus,
  onStatusChange,
  disabled = false,
  goingCount,
  interestedCount,
}: RSVPButtonGroupProps) {
  return (
    <div className="flex flex-wrap gap-3" role="group" aria-label="RSVP">
      {CHOICES.map(({ status, label, Icon, active, hover }) => {
        const on = currentStatus === status;
        const count =
          status === "going"
            ? goingCount
            : status === "interested"
              ? interestedCount
              : undefined;

        return (
          <button
            key={status}
            onClick={() => onStatusChange(on ? null : status)}
            disabled={disabled}
            aria-pressed={on}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-400",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              on
                ? active
                : `border-gray-200 text-gray-500 bg-white ${hover}`,
            )}
          >
            <Icon className="size-3.5" />
            {label}
            {count !== undefined && count > 0 && (
              <span className="text-xs opacity-80">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
