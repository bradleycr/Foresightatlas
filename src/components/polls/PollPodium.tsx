/**
 * The prize board. First, second, and third sit up front; the rest of the
 * field stays readable underneath. A place is the point total.
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
            <p className={cn("font-semibold uppercase tracking-[0.18em] text-neutral-500", stage ? "text-sm" : "text-[11px]")}>
              {leaders.filter((row) => row.place === option.place).length > 1
                ? `Tied for ${PLACE[option.place - 1] || `${option.place}th`}`
                : PLACE[option.place - 1] || `${option.place}th`}
            </p>
            <p
              className={cn(
                "font-heading mt-1 font-bold leading-snug text-inherit",
                stage ? "text-2xl sm:text-4xl" : "text-lg",
              )}
            >
              {option.label}
            </p>
            {option.people ? (
              <p className={cn("mt-1 text-neutral-600", stage ? "text-sm sm:text-lg" : "text-sm")}>
                {option.people}
              </p>
            ) : null}
            <p className={cn("mt-3 tabular-nums text-neutral-700", stage ? "text-lg sm:text-2xl" : "text-sm")}>
              <span className="font-semibold">{option.points}</span>
              {" "}
              {option.points === 1 ? "point" : "points"}
            </p>
          </li>
        ))}
      </ol>
      {rest.length > 0 ? (
        <ul className="mt-4 divide-y divide-black/5">
          {rest.map((option) => (
            <li key={option.id} className="flex items-baseline justify-between gap-3 py-2.5">
              <p className="min-w-0">
                <span className="mr-2 tabular-nums text-neutral-400">
                  {option.place}.
                  {results.filter((row) => row.place === option.place).length > 1 ? " tied" : ""}
                </span>
                <span className={cn("font-medium", stage && "text-xl")}>{option.label}</span>
                {option.people ? (
                  <span className="mt-0.5 block text-xs text-neutral-500 sm:ml-7 sm:mt-0 sm:inline">
                    {option.people}
                  </span>
                ) : null}
              </p>
              <p className={cn("shrink-0 tabular-nums text-neutral-500", stage ? "text-2xl font-semibold" : "text-sm")}>{option.points}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {stage ? null : (
        <p className="mt-4 text-xs text-neutral-500">
          {totalBallots} vote{totalBallots === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
