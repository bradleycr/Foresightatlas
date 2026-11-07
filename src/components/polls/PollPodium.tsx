/**
 * The prize board. First, second, and third sit up front; the rest of the
 * field stays readable underneath. Points are favorite × 2 plus runner-up × 1.
 */

import type { PollResultOption } from "../../types/polls";
import { cn } from "../ui/utils";

interface PollPodiumProps {
  results: PollResultOption[];
  totalBallots: number;
  size?: "phone" | "stage";
}

const PLACE = ["1st", "2nd", "3rd"] as const;

export function PollPodium({ results, totalBallots, size = "phone" }: PollPodiumProps) {
  const stage = size === "stage";
  const leaders = results.filter((option) => option.place <= 3 && option.points > 0);
  const rest = results.filter((option) => !leaders.includes(option));

  if (totalBallots === 0) {
    return <p className="text-sm text-gray-600">No ballots yet.</p>;
  }

  return (
    <div>
      <ol className={cn("grid gap-3", stage ? "sm:grid-cols-3" : "")}>
        {leaders.map((option) => (
          <li
            key={option.id}
            className={cn(
              "rounded-2xl border px-4 py-4",
              option.place === 1
                ? "border-[#e4c27a] bg-[#fbf6ea]"
                : "border-black/10 bg-white/80",
              stage && option.place === 1 && "sm:order-none",
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              {PLACE[option.place - 1] || `${option.place}th`}
              {leaders.filter((row) => row.place === option.place).length > 1 ? " · tied" : ""}
            </p>
            <p className={cn("font-heading mt-1 font-bold leading-snug text-inherit", stage ? "text-2xl" : "text-lg")}>
              {option.label}
            </p>
            {option.people ? (
              <p className="mt-1 text-sm text-neutral-600">{option.people}</p>
            ) : null}
            <p className="mt-3 text-sm tabular-nums text-neutral-700">
              <span className="font-semibold">{option.points}</span>
              {" "}
              {option.points === 1 ? "point" : "points"}
              <span className="text-neutral-500">
                {" "}· {option.firsts} favorite{option.firsts === 1 ? "" : "s"}
              </span>
            </p>
          </li>
        ))}
      </ol>
      {rest.length > 0 ? (
        <ul className="mt-4 divide-y divide-black/5">
          {rest.map((option) => (
            <li key={option.id} className="flex items-baseline justify-between gap-3 py-2.5">
              <p className="min-w-0">
                <span className="mr-2 tabular-nums text-neutral-400">{option.place}.</span>
                <span className="font-medium">{option.label}</span>
                {option.people ? (
                  <span className="mt-0.5 block text-xs text-neutral-500 sm:ml-7 sm:mt-0 sm:inline">
                    {option.people}
                  </span>
                ) : null}
              </p>
              <p className="shrink-0 text-sm tabular-nums text-neutral-500">{option.points}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-xs text-neutral-500">
        {totalBallots} ballot{totalBallots === 1 ? "" : "s"}
        {" "}· a favorite is 2 points, a runner-up is 1
      </p>
    </div>
  );
}
