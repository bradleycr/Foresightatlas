/**
 * RSVPButtonGroup — clean, modern three-state toggle.
 * Active states use soft fills with clear feedback.
 * Tapping the active status deselects it.
 */

import { Check, Star, X } from "lucide-react";
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
  activeClasses: string;
  hoverClasses: string;
}[] = [
  {
    status: "going",
    label: "Going",
    Icon: Check,
    activeClasses: "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-200",
    hoverClasses: "hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700",
  },
  {
    status: "interested",
    label: "Interested",
    Icon: Star,
    activeClasses: "bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-200",
    hoverClasses: "hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700",
  },
  {
    status: "not-going",
    label: "Can't go",
    Icon: X,
    activeClasses: "bg-gray-500 border-gray-500 text-white shadow-sm",
    hoverClasses: "hover:bg-gray-50 hover:border-gray-300 hover:text-gray-600",
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
    <div className="flex flex-wrap gap-2" role="group" aria-label="RSVP">
      {CHOICES.map(({ status, label, Icon, activeClasses, hoverClasses }) => {
        const on = currentStatus === status;
        const count =
          status === "going" ? goingCount
            : status === "interested" ? interestedCount
              : undefined;

        return (
          <button
            key={status}
            onClick={() => onStatusChange(on ? null : status)}
            disabled={disabled}
            aria-pressed={on}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-teal-400",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              on
                ? activeClasses
                : `border-gray-200 text-gray-500 bg-white ${hoverClasses}`,
            )}
          >
            <Icon className={cn("size-3.5", on && "drop-shadow-sm")} />
            {label}
            {count !== undefined && count > 0 && (
              <span className={cn(
                "text-xs tabular-nums ml-0.5",
                on ? "text-white/80" : "text-gray-400",
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
