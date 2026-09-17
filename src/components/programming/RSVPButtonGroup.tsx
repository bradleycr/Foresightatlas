/**
 * RSVPButtonGroup — pill-rounded RSVP toggles.
 *
 * Going = confirmed attending. Interested = might attend (not the same as going).
 * When status comes from Luma, pills are locked — cancel on Luma to change here.
 */

import { Check, Star, X } from "lucide-react";
import { RSVPStatus, NodeColorTheme } from "../../types/events";
import { cn } from "../ui/utils";

interface RSVPButtonGroupProps {
  currentStatus: RSVPStatus | null;
  onStatusChange: (status: RSVPStatus | null) => void;
  disabled?: boolean;
  /** When true, registration is owned by Luma — Atlas toggles are read-only. */
  lumaBacked?: boolean;
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
  /** Clarifies how this differs from Going (for accessibility and tooltips). */
  ariaDescription?: string;
}[] = [
  {
    status: "going",
    label: "Going",
    Icon: Check,
    on: "bg-emerald-100 text-emerald-700 border-emerald-200",
    off: "hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700",
    ariaDescription: "Confirmed attending — you're going",
  },
  {
    status: "interested",
    label: "Interested",
    Icon: Star,
    on: "bg-amber-100 text-amber-700 border-amber-200",
    off: "hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700",
    ariaDescription: "Might attend — not the same as Going",
  },
  {
    status: "not-going",
    label: "Can't go",
    Icon: X,
    on: "bg-gray-100 text-gray-600 border-gray-300",
    off: "hover:bg-gray-50 hover:border-gray-300 hover:text-gray-600",
    ariaDescription: "Not attending",
  },
];

export function RSVPButtonGroup({
  currentStatus,
  onStatusChange,
  disabled = false,
  lumaBacked = false,
  goingCount,
  interestedCount,
  theme,
}: RSVPButtonGroupProps) {
  const locked = disabled || lumaBacked;

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label={
        lumaBacked
          ? "RSVP from Luma — cancel on Luma to change here"
          : "RSVP: Going means confirmed attending, Interested means might attend"
      }
    >
      {CHOICES.map(({ status, label, Icon, on, off, ariaDescription }) => {
        const active = currentStatus === status;
        const count =
          status === "going" ? goingCount
            : status === "interested" ? interestedCount
              : undefined;

        return (
          <button
            key={status}
            onClick={() => {
              if (lumaBacked) return;
              onStatusChange(active ? null : status);
            }}
            disabled={locked}
            aria-pressed={active}
            title={
              lumaBacked
                ? "Registered on Luma — cancel there to update here"
                : ariaDescription
            }
            aria-label={count !== undefined && count > 0 ? `${label} (${count})` : label}
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
              <span className="text-xs opacity-90" aria-hidden>({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
