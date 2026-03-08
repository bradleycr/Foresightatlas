/**
 * MonthNavigator — compact 6×2 grid of month cells.
 *
 * Each cell is a "view this month" control: month name is the primary label,
 * and the number is explicitly the event count (not a date). Visual treatment
 * (icon + "events" sublabel) makes that unambiguous.
 *
 * Selected / current-month accent is driven by the per-node NodeColorTheme.
 */

import { CalendarDays } from "lucide-react";
import { cn } from "../ui/utils";
import { NodeColorTheme } from "../../types/events";

interface MonthNavigatorProps {
  selected: number | null;
  year: number;
  counts: number[];
  onChange: (month: number | null) => void;
  theme: NodeColorTheme;
}

const SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function MonthNavigator({
  selected,
  year,
  counts,
  onChange,
  theme,
}: MonthNavigatorProps) {
  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() : -1;
  const totalEvents = counts.reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Year row */}
      <div className="flex items-center justify-between mb-5 sm:mb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-900">{year}</span>
          <span className="text-xs text-gray-400">{totalEvents} events</span>
        </div>
        <button
          onClick={() => onChange(null)}
          className={cn(
            "text-xs font-medium px-3 py-2 rounded-md transition-all",
            selected === null ? theme.allUpcomingActive : theme.allUpcomingIdle,
          )}
        >
          All upcoming
        </button>
      </div>

      {/* Month grid — each cell: month name + event count (clearly not a date) */}
      <div className="grid gap-2 sm:gap-2.5" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        {SHORT.map((label, i) => {
          const isSelected = selected === i;
          const isCurrent = i === currentMonth;
          const hasEvents = counts[i] > 0;
          const count = counts[i];

          return (
            <button
              key={label}
              type="button"
              onClick={() => onChange(isSelected ? null : i)}
              className={cn(
                "relative rounded-xl py-3 px-3 sm:py-3.5 sm:px-4 text-center transition-all",
                "min-h-[4.5rem] sm:min-h-[5rem] flex flex-col items-center justify-center gap-0.5",
                "focus-visible:outline-none focus-visible:ring-2",
                theme.focusRing,
                isSelected
                  ? theme.monthSelected
                  : isCurrent
                    ? theme.monthCurrent
                    : hasEvents
                      ? "bg-gradient-to-br from-gray-50 to-gray-100/90 hover:from-gray-100 hover:to-gray-200/90 border border-transparent"
                      : "bg-gray-50/50 border border-transparent text-gray-400",
              )}
              aria-label={`View ${label}: ${count} event${count !== 1 ? "s" : ""}`}
            >
              {/* Month name — primary "select this month" label */}
              <div className={cn(
                "text-[11px] sm:text-xs font-medium leading-none",
                isSelected
                  ? theme.monthSelectedLabel
                  : isCurrent
                    ? theme.monthCurrentLabel
                    : "text-gray-500",
              )}>
                {label}
              </div>
              {/* Event count: icon + number + "events" so it's clearly not a date */}
              <div className="flex flex-col items-center gap-0.5 mt-1.5 sm:mt-2">
                <div className={cn(
                  "flex items-center justify-center gap-1 tabular-nums",
                  "text-sm font-bold leading-none",
                  isSelected
                    ? theme.monthSelectedCount
                    : hasEvents
                      ? "text-gray-900"
                      : "text-gray-300",
                )}>
                  <CalendarDays
                    className={cn(
                      "size-3.5 sm:size-4 opacity-70",
                      isSelected ? "opacity-90" : hasEvents ? "text-gray-600" : "text-gray-300",
                    )}
                    aria-hidden
                  />
                  <span>{count}</span>
                </div>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider leading-none",
                    isSelected ? "opacity-80" : hasEvents ? "text-gray-500" : "text-gray-400",
                  )}
                >
                  events
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <p className="text-xs text-gray-400 mt-4 sm:mt-5">
          <span className="text-gray-600 font-medium">{SHORT[selected]}</span>
          {" · "}{counts[selected]} event{counts[selected] !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
