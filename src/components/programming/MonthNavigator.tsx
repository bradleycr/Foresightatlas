/**
 * MonthNavigator — simple month filter.
 * All months look the same; only selected state changes. No extra styling.
 */

import { useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected === null) return;
    const strip = stripRef.current;
    if (!strip) return;
    const btn = strip.querySelector<HTMLButtonElement>(`[data-month="${selected}"]`);
    btn?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selected]);

  const step = (dir: -1 | 1) => {
    if (selected === null) onChange(dir === 1 ? 0 : 11);
    else {
      const next = selected + dir;
      if (next >= 0 && next <= 11) onChange(next);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {year}
        </span>
        {selected !== null && (
          <button
            onClick={() => onChange(null)}
            className="text-xs font-medium text-teal-600 hover:text-teal-800"
          >
            Show all upcoming
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => step(-1)}
          disabled={selected === 0}
          aria-label="Previous month"
          className={cn(
            "flex-shrink-0 size-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
          )}
        >
          <ChevronLeft className="size-4" />
        </button>

        <div
          ref={stripRef}
          className="flex-1 flex gap-2 overflow-x-auto scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {MONTHS.map((_, i) => {
            const on = selected === i;
            return (
              <button
                key={SHORT[i]}
                data-month={i}
                onClick={() => onChange(on ? null : i)}
                aria-pressed={on}
                className={cn(
                  "flex-shrink-0 rounded-lg border text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
                  "min-w-[4.5rem] min-h-[4rem] px-4 py-3.5 flex flex-col justify-center gap-0.5",
                  on ? "month-nav-selected" : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50",
                )}
              >
                <span className="text-xs font-medium">{SHORT[i]}</span>
                <span className="text-sm font-semibold tabular-nums">
                  {counts[i]}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => step(1)}
          disabled={selected === 11}
          aria-label="Next month"
          className={cn(
            "flex-shrink-0 size-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
          )}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {selected !== null && (
        <p className="text-sm text-gray-500 pt-1">
          {MONTHS[selected]} · {counts[selected]} event{counts[selected] !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
