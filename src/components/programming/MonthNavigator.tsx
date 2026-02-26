/**
 * MonthNavigator — compact 6×2 grid of month cells.
 *
 * The selected / current-month accent is driven entirely by the per-node
 * NodeColorTheme so Berlin gets its violet–rose palette and SF gets its
 * amber–sky palette — matching the pastel gradient language of the map
 * sidebar and detail cards.
 */

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

      {/* Month grid — Apple-style gaps */}
      <div className="grid gap-2 sm:gap-2.5" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        {SHORT.map((label, i) => {
          const isSelected = selected === i;
          const isCurrent = i === currentMonth;
          const hasEvents = counts[i] > 0;

          return (
            <button
              key={label}
              onClick={() => onChange(isSelected ? null : i)}
              className={cn(
                "relative rounded-xl py-3 px-3 sm:py-3.5 sm:px-4 text-center transition-all",
                "min-h-[4rem] sm:min-h-[4.5rem] flex flex-col items-center justify-center",
                "focus-visible:outline-none focus-visible:ring-2",
                theme.focusRing,
                isSelected
                  ? theme.monthSelected
                  : isCurrent
                    ? theme.monthCurrent
                    : hasEvents
                      ? "bg-gray-50 hover:bg-gray-100 border border-transparent"
                      : "bg-gray-50/50 border border-transparent text-gray-400",
              )}
            >
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
              <div className={cn(
                "text-sm font-bold leading-none mt-2 sm:mt-2.5 tabular-nums",
                isSelected
                  ? theme.monthSelectedCount
                  : hasEvents
                    ? "text-gray-900"
                    : "text-gray-300",
              )}>
                {counts[i]}
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
