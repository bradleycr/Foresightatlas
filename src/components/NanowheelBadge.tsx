/**
 * <NanowheelBadge /> — the visible face of Foresight's internal currency.
 *
 * A nanowheel (◎) is the community's trust-based token: +1 each time a member
 * checks in at a node or RSVPs "going" to an event. This component renders the
 * Foresight icon mark alongside a number, with a Radix tooltip that explains
 * what nanowheels are to first-time viewers.
 *
 * Sizes:
 *   • "sm"  — inline next to a name (used in PersonDetailModal header)
 *   • "md"  — at-a-glance pill in context cards
 *   • "lg"  — prominent on own profile page (hero area)
 *
 * Per the project's design brief: no on-screen word ("nanowheels"), just the
 * mark and the count. The tooltip carries the meaning, keeping the UI minimal.
 */

import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import foresightIconUrl from "../assets/Foresight_RGB_Icon_Black.png?url";
import { cn } from "./ui/utils";

export type NanowheelBadgeSize = "sm" | "md" | "lg";

interface NanowheelBadgeProps {
  /** Current total count for the person. Pass 0 to hide gracefully via {@link hideWhenZero}. */
  count: number;
  size?: NanowheelBadgeSize;
  /** When true and count is 0, renders nothing. Defaults to false for own profile. */
  hideWhenZero?: boolean;
  /** Compose extra classnames (e.g. to align with surrounding layout). */
  className?: string;
  /** Optional override for the tooltip body; defaults to the canonical description. */
  tooltipLabel?: string;
  /** ARIA label for screen readers when the number alone isn't enough context. */
  ariaLabel?: string;
}

const SIZE_CLASSES: Record<NanowheelBadgeSize, {
  container: string;
  icon: string;
  text: string;
}> = {
  sm: {
    container: "gap-1 px-1.5 py-0.5 text-[11px] rounded-full",
    icon: "size-3",
    text: "font-semibold tabular-nums tracking-tight",
  },
  md: {
    container: "gap-1.5 px-2 py-1 text-xs rounded-full",
    icon: "size-3.5",
    text: "font-semibold tabular-nums tracking-tight",
  },
  lg: {
    container: "gap-2 px-3 py-1.5 text-sm rounded-xl",
    icon: "size-5",
    text: "font-semibold tabular-nums tracking-tight text-base",
  },
};

const DEFAULT_TOOLTIP =
  "Nanowheels — Foresight's community currency. Earn one each time you check in at a node or RSVP \"going\" to an event.";

export function NanowheelBadge({
  count,
  size = "md",
  hideWhenZero = false,
  className,
  tooltipLabel = DEFAULT_TOOLTIP,
  ariaLabel,
}: NanowheelBadgeProps) {
  if (hideWhenZero && count <= 0) return null;

  const s = SIZE_CLASSES[size];
  const label = ariaLabel ?? `${count} nanowheels`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center border border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-indigo-50/60 text-sky-900 shadow-sm",
            s.container,
            className,
          )}
          aria-label={label}
          role="img"
        >
          <img
            src={foresightIconUrl}
            alt=""
            className={cn(
              "object-contain drop-shadow-[0_0_1px_rgba(14,165,233,0.15)]",
              s.icon,
            )}
            aria-hidden
          />
          <span className={s.text}>{count}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
        {tooltipLabel}
      </TooltipContent>
    </Tooltip>
  );
}
