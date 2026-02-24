/**
 * Horizontal 12-month density strip.
 * Each cell: month label on one line, event count on the next with clear spacing.
 */

import { useMemo } from "react";
import { NodeEvent } from "../../types/events";
import { cn } from "../ui/utils";

interface YearOverviewProps {
  events: NodeEvent[];
  year?: number;
  onMonthClick?: (month: number) => void;
  highlightMonth?: number | null;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function YearOverview({
  events,
  year = 2026,
  onMonthClick,
  highlightMonth,
}: YearOverviewProps) {
  const counts = useMemo(() => {
    const c = new Array(12).fill(0) as number[];
    for (const ev of events) {
      const m = new Date(ev.startAt);
      if (m.getFullYear() === year) c[m.getMonth()]++;
    }
    return c;
  }, [events, year]);

  const peak = Math.max(...counts, 1);
  const now = new Date();
  const curMonth = now.getFullYear() === year ? now.getMonth() : -1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {year} at a glance
        </span>
        <span className="text-sm text-gray-500">
          {events.length} events total
        </span>
      </div>

      <div
        className="gap-2 sm:gap-3"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
        }}
      >
        {MONTHS.map((name, i) => {
          const pct = counts[i] / peak;
          const isCurrent = i === curMonth;
          const isHighlighted = i === highlightMonth;

          return (
            <button
              key={name}
              type="button"
              onClick={() => onMonthClick?.(i)}
              className={cn(
                "rounded-xl py-3 px-2 flex flex-col items-center justify-center gap-1.5 min-h-[4rem] transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1",
                isCurrent && "ring-2 ring-blue-400 ring-offset-1",
                isHighlighted && "ring-2 ring-indigo-400 ring-offset-1",
                onMonthClick ? "cursor-pointer hover:scale-[1.02]" : "cursor-default",
              )}
              style={{
                backgroundColor:
                  counts[i] > 0
                    ? `rgba(99, 102, 241, ${(0.1 + pct * 0.2).toFixed(2)})`
                    : "rgba(0, 0, 0, 0.04)",
              }}
            >
              <span className="text-xs font-semibold text-gray-600 leading-none">
                {name}
              </span>
              <span
                className={cn(
                  "text-base font-bold tabular-nums leading-none",
                  counts[i] > 0 ? "text-indigo-600" : "text-gray-300",
                )}
              >
                {counts[i]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
