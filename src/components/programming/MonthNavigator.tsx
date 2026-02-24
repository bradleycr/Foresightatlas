/**
 * MonthNavigator — full-year calendar grid with density visualization.
 * Replaces the cramped horizontal scroll strip with a spacious 4×3 grid
 * (3×4 on small screens) that gives an at-a-glance view of the year.
 */

import { cn } from "../ui/utils";

interface MonthNavigatorProps {
  selected: number | null;
  year: number;
  counts: number[];
  onChange: (month: number | null) => void;
}

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const SHORT = [
  "Jan", "Feb", "Mar", "Apr",
  "May", "Jun", "Jul", "Aug",
  "Sep", "Oct", "Nov", "Dec",
];

export function MonthNavigator({
  selected,
  year,
  counts,
  onChange,
}: MonthNavigatorProps) {
  const peak = Math.max(...counts, 1);
  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() : -1;
  const totalEvents = counts.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold text-gray-900 tabular-nums">{year}</span>
          <span className="text-sm text-gray-400">{totalEvents} events</span>
        </div>
        <button
          onClick={() => onChange(null)}
          className={cn(
            "text-sm font-medium px-3 py-1.5 rounded-lg transition-all",
            selected === null
              ? "bg-teal-50 text-teal-700"
              : "text-teal-600 hover:bg-teal-50/60 hover:text-teal-700",
          )}
        >
          All upcoming
        </button>
      </div>

      {/* Month grid: 4 columns on sm+, 3 on mobile */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5">
        {MONTHS.map((_, i) => {
          const isSelected = selected === i;
          const isCurrent = i === currentMonth;
          const hasEvents = counts[i] > 0;
          const density = counts[i] / peak;

          return (
            <button
              key={SHORT[i]}
              onClick={() => onChange(isSelected ? null : i)}
              aria-pressed={isSelected}
              className={cn(
                "relative rounded-xl px-3 py-3.5 flex flex-col items-center gap-2 transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1",
                isSelected
                  ? "bg-teal-600 text-white shadow-md shadow-teal-200/50 scale-[1.02]"
                  : hasEvents
                    ? "bg-white border border-gray-200 hover:border-teal-200 hover:shadow-sm hover:bg-teal-50/30"
                    : "bg-gray-50/80 border border-gray-100 text-gray-400 hover:bg-gray-50",
              )}
            >
              {/* Current month dot */}
              {isCurrent && !isSelected && (
                <div className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-teal-500" />
              )}

              <span className={cn(
                "text-xs font-semibold tracking-wide",
                isSelected ? "text-teal-100" : hasEvents ? "text-gray-500" : "text-gray-400",
              )}>
                {SHORT[i]}
              </span>

              {/* Event count */}
              <span className={cn(
                "text-xl font-bold tabular-nums leading-none",
                isSelected
                  ? "text-white"
                  : hasEvents
                    ? "text-gray-900"
                    : "text-gray-300",
              )}>
                {counts[i]}
              </span>

              {/* Density bar */}
              <div className={cn(
                "w-full h-1 rounded-full overflow-hidden",
                isSelected ? "bg-teal-500/40" : "bg-gray-100",
              )}>
                {hasEvents && (
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      isSelected ? "bg-white/80" : "bg-teal-400",
                    )}
                    style={{ width: `${Math.max(density * 100, 12)}%` }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected month label */}
      {selected !== null && (
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-700">{MONTHS[selected]}</span>
          {" · "}
          {counts[selected]} event{counts[selected] !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
