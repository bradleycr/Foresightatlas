/**
 * RSVPButtonGroup — pill-rounded RSVP toggles.
 *
 * Active states (going/interested/can't-go) are semantically coloured regardless
 * of node. Only the keyboard-focus ring inherits the node's pastel theme so
 * the overall palette stays cohesive.
 */

import { Check, Star, X } from "lucide-react";
import { RSVPStatus, NodeColorTheme } from "../../types/events";
import { cn } from "../ui/utils";

interface RSVPButtonGroupProps {
  currentStatus: RSVPStatus | null;
  onStatusChange: (status: RSVPStatus | null) => void;
  disabled?: boolean;
  goingCount?: number;
  interestedCount?: number;
  theme?: NodeColorTheme;
}

const CHOICES: {
  status: RSVPStatus;
  label: string;
  Icon: typeof Check;
  on: string;
  off: string;
}[] = [
  {
    status: "going",
    label: "Going",
    Icon: Check,
    on: "bg-emerald-100 text-emerald-700 border-emerald-200",
    off: "hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700",
  },
  {
    status: "interested",
    label: "Interested",
    Icon: Star,
    on: "bg-amber-100 text-amber-700 border-amber-200",
    off: "hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700",
  },
  {
    status: "not-going",
    label: "Can't go",
    Icon: X,
    on: "bg-gray-100 text-gray-600 border-gray-300",
    off: "hover:bg-gray-50 hover:border-gray-300 hover:text-gray-600",
  },
];

export function RSVPButtonGroup({
  currentStatus,
  onStatusChange,
  disabled = false,
  goingCount,
  interestedCount,
  theme,
}: RSVPButtonGroupProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="RSVP">
      {CHOICES.map(({ status, label, Icon, on, off }) => {
        const active = currentStatus === status;
        const count =
          status === "going" ? goingCount
            : status === "interested" ? interestedCount
              : undefined;

        return (
          <button
            key={status}
            onClick={() => onStatusChange(active ? null : status)}
            disabled={disabled}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold border transition-all",
              cn("focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1", theme?.focusRing ?? "focus-visible:ring-gray-400"),
              "disabled:opacity-50 disabled:cursor-not-allowed",
              active
                ? on
                : `border-gray-200 text-gray-500 bg-white ${off}`,
            )}
          >
            <Icon className="size-3" />
            {label}
            {count !== undefined && count > 0 && (
              <span className="text-xs opacity-70">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
