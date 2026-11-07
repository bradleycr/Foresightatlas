/**
 * The step before the ballot. A phone names its team, confirms it,
 * and only then can give points. That team stays locked out.
 */

import { useState } from "react";
import type { PollOption } from "../../types/polls";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";

interface PollTeamGateProps {
  options: PollOption[];
  onConfirm: (id: string) => void;
}

export function PollTeamGate({ options, onConfirm }: PollTeamGateProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="mt-3">
      <p className="text-sm leading-snug text-neutral-600">
        This is trust-based. You can’t vote for your own team.
      </p>
      <ul className="mt-5 space-y-2">
        {options.map((option) => {
          const on = option.id === selected;
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => setSelected(option.id)}
                aria-pressed={on}
                className={cn(
                  "min-h-[56px] w-full rounded-2xl border px-4 py-3 text-left touch-manipulation",
                  on ? "border-[#1a140c] bg-[#fbf6ea]" : "border-black/10 bg-white active:bg-neutral-50",
                )}
              >
                <span className="block font-medium leading-snug text-neutral-900">{option.label}</span>
                {option.people ? (
                  <span className="mt-0.5 block text-xs leading-snug text-neutral-500">{option.people}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        disabled={!selected}
        onClick={() => selected && onConfirm(selected)}
        className="mt-5 min-h-[48px] w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
      >
        This is my team
      </Button>
    </div>
  );
}
