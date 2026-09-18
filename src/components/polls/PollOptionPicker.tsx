/**
 * Compact, searchable option list for phone voting.
 *
 * Long polls (favourite-project, 20+ names) need a filter and 44px rows —
 * not a stack of oversized cards. The selected choice pins to the bottom
 * so your thumb always knows what you picked.
 */

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { PollOption } from "../../types/polls";
import { cn } from "../ui/utils";

interface PollOptionPickerProps {
  options: PollOption[];
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (optionId: string) => void;
}

export function PollOptionPicker({
  options,
  selectedId,
  disabled,
  onSelect,
}: PollOptionPickerProps) {
  const [query, setQuery] = useState("");
  const longList = options.length >= 8;
  const selected = options.find((o) => o.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div>
      {longList ? (
        <label className="relative mb-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${options.length} options`}
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3 text-base text-neutral-900 shadow-sm outline-none placeholder:text-neutral-400 focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--primary)_18%,transparent)]"
          />
        </label>
      ) : null}

      <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {filtered.map((option) => {
          const isOn = selectedId === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(option.id)}
                className={cn(
                  "flex min-h-[48px] w-full items-center gap-3 px-3.5 py-2.5 text-left touch-manipulation",
                  isOn ? "bg-[color-mix(in_oklab,var(--primary)_6%,white)]" : "bg-white active:bg-neutral-50",
                  disabled && "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                    isOn
                      ? "bg-[var(--primary)] text-white"
                      : "bg-neutral-100 text-neutral-500",
                  )}
                >
                  {option.id}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 text-[15px] leading-snug",
                    isOn ? "font-semibold text-[var(--primary)]" : "font-medium text-neutral-900",
                  )}
                >
                  {option.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 ? (
        <p className="mt-3 text-center text-sm text-neutral-500">No matches. Try another word.</p>
      ) : null}

      {selected ? (
        <div className="pointer-events-none sticky bottom-3 z-10 mt-4">
          <p className="rounded-2xl border border-neutral-200 bg-white/95 px-4 py-3 text-sm text-[var(--primary)] shadow-sm backdrop-blur">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Your vote
            </span>
            <span className="mt-0.5 block font-medium leading-snug">{selected.label}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
