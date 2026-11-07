/**
 * One phone, two picks. The first slot is the favorite (2 points), the
 * second is the runner-up (1). Tapping a selected project clears it.
 * Tapping a new one fills the empty slot, favorite first.
 */

import type { PollOption } from "../../types/polls";
import { cn } from "../ui/utils";

interface PollBallotProps {
  options: PollOption[];
  firstId: string | null;
  secondId: string | null;
  disabled?: boolean;
  onChange: (next: { firstId: string | null; secondId: string | null }) => void;
}

export function PollBallot({
  options,
  firstId,
  secondId,
  disabled,
  onChange,
}: PollBallotProps) {
  const choose = (id: string) => {
    if (disabled) return;
    if (id === firstId) {
      onChange({ firstId: null, secondId });
      return;
    }
    if (id === secondId) {
      onChange({ firstId, secondId: null });
      return;
    }
    if (!firstId) {
      onChange({ firstId: id, secondId });
      return;
    }
    if (!secondId) {
      onChange({ firstId, secondId: id });
      return;
    }
    onChange({ firstId, secondId: id });
  };

  return (
    <ul className="overflow-hidden rounded-2xl border border-black/10 bg-white">
      {options.map((option) => {
        const rank = option.id === firstId ? 1 : option.id === secondId ? 2 : 0;
        return (
          <li key={option.id} className="border-b border-black/5 last:border-b-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => choose(option.id)}
              className={cn(
                "flex min-h-[56px] w-full items-center gap-3 px-3.5 py-3 text-left touch-manipulation",
                rank === 1 && "bg-[#fbf6ea]",
                rank === 2 && "bg-neutral-50",
                !rank && "active:bg-neutral-50",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  rank === 1 && "bg-[#1a140c] text-[#f6f1e7]",
                  rank === 2 && "bg-neutral-800 text-white",
                  !rank && "bg-neutral-100 text-neutral-400",
                )}
                aria-hidden
              >
                {rank === 1 ? "2" : rank === 2 ? "1" : ""}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium leading-snug text-neutral-900">
                  {option.label}
                </span>
                {option.people ? (
                  <span className="mt-0.5 block text-xs leading-snug text-neutral-500">
                    {option.people}
                  </span>
                ) : null}
              </span>
              {option.url ? (
                <a
                  href={option.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="shrink-0 rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-600"
                >
                  Demo
                </a>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
