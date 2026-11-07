/**
 * The door into the ballot. A phone names its team once, on trust,
 * and that team is then locked out of the points.
 */

import type { PollOption } from "../../types/polls";

interface PollTeamGateProps {
  options: PollOption[];
  onSelect: (id: string) => void;
}

export function PollTeamGate({ options, onSelect }: PollTeamGateProps) {
  return (
    <div className="mt-5">
      <p className="font-heading text-2xl font-bold leading-tight">Select your team</p>
      <p className="mt-2 text-sm leading-snug text-neutral-600">
        This is trust-based. You can’t vote for your own team.
      </p>
      <ul className="mt-5 space-y-2">
        {options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              onClick={() => onSelect(option.id)}
              className="min-h-[56px] w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-left touch-manipulation active:bg-neutral-50"
            >
              <span className="block font-medium leading-snug text-neutral-900">{option.label}</span>
              {option.people ? (
                <span className="mt-0.5 block text-xs leading-snug text-neutral-500">{option.people}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
