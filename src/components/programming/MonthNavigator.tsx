/**
 * MonthNavigator — compact two-row month selector.
 * Takes up minimal vertical space while still showing the full year
 * at a glance with event counts and a selected-state highlight.
 */

import { cn } from "../ui/utils";

interface MonthNavigatorProps {
  selected: number | null;
  year: number;
  counts: number[];
  onChange: (month: number | null) => void;
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
}: MonthNavigatorProps) {
  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() : -1;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900 tabular-nums">{year}</span>
        <button
          onClick={() => onChange(null)}
          className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-md transition-all",
            selected === null
              ? "bg-teal-50 text-teal-700"
              : "text-teal-600 hover:bg-teal-50/60",
          )}
        >
          All upcoming
        </button>
      </div>

      {/* Compact 6-column grid — always 2 rows */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: "repeat(6, 1fr)" }}
      >
        {SHORT.map((label, i) => {
          const isSelected = selected === i;
          const isCurrent = i === currentMonth;
          const hasEvents = counts[i] > 0;

          return (
            <button
              key={label}
              onClick={() => onChange(isSelected ? null : i)}
              aria-pressed={isSelected}
              className={cn(
                "relative rounded-lg py-2 px-1 text-center transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
                isSelected
                  ? "bg-teal-600 text-white shadow-sm"
                  : hasEvents
                    ? "bg-white hover:bg-teal-50 border border-gray-200 hover:border-teal-200"
                    : "bg-gray-50 border border-transparent text-gray-400",
              )}
            >
              {isCurrent && !isSelected && (
                <div className="absolute top-1 right-1 size-1 rounded-full bg-teal-500" />
              )}
              <div className={cn(
                "text-[11px] font-medium leading-none",
                isSelected ? "text-teal-100" : hasEvents ? "text-gray-500" : "text-gray-400",
              )}>
                {label}
              </div>
              <div className={cn(
                "text-sm font-bold leading-none mt-1 tabular-nums",
                isSelected ? "text-white" : hasEvents ? "text-gray-900" : "text-gray-300",
              )}>
                {counts[i]}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
