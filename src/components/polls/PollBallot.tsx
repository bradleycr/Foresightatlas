/**
 * A points ballot, not a podium.
 *
 * Three points, then two, then one, each to a different project.
 * The voter’s own team is present and gray, and it cannot take a slot.
 */

import { Github } from "lucide-react";
import type { PollOption } from "../../types/polls";
import { cn } from "../ui/utils";

interface PollBallotProps {
  options: PollOption[];
  teamId: string;
  firstId: string | null;
  secondId: string | null;
  thirdId: string | null;
  disabled?: boolean;
  onChange: (next: { firstId: string | null; secondId: string | null; thirdId: string | null }) => void;
}

const AWARD: Record<number, string> = { 3: "3 points", 2: "2 points", 1: "1 point" };

export function PollBallot({
  options,
  teamId,
  firstId,
  secondId,
  thirdId,
  disabled,
  onChange,
}: PollBallotProps) {
  const byId = (id: string | null) => options.find((option) => option.id === id) ?? null;

  const choose = (id: string) => {
    if (disabled || id === teamId) return;
    if (id === firstId) {
      onChange({ firstId: null, secondId, thirdId });
      return;
    }
    if (id === secondId) {
      onChange({ firstId, secondId: null, thirdId });
      return;
    }
    if (id === thirdId) {
      onChange({ firstId, secondId, thirdId: null });
      return;
    }
    if (!firstId) {
      onChange({ firstId: id, secondId, thirdId });
      return;
    }
    if (!secondId) {
      onChange({ firstId, secondId: id, thirdId });
      return;
    }
    if (!thirdId) {
      onChange({ firstId, secondId, thirdId: id });
      return;
    }
    onChange({ firstId, secondId, thirdId: id });
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        <PointSlot
          points={3}
          title="Favourite"
          project={byId(firstId)}
          tone="gold"
          onClear={() => onChange({ firstId: null, secondId, thirdId })}
        />
        <PointSlot
          points={2}
          title="Second"
          project={byId(secondId)}
          tone="mid"
          onClear={() => onChange({ firstId, secondId: null, thirdId })}
        />
        <PointSlot
          points={1}
          title="Third"
          project={byId(thirdId)}
          tone="ink"
          onClear={() => onChange({ firstId, secondId, thirdId: null })}
        />
      </div>
      <ul className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-white">
        {options.map((option) => {
          const own = option.id === teamId;
          const award = option.id === firstId ? 3 : option.id === secondId ? 2 : option.id === thirdId ? 1 : 0;
          return (
            <li
              key={option.id}
              className={cn(
                "flex items-center border-b border-black/5 last:border-b-0",
                own && "bg-neutral-100 text-neutral-400",
              )}
            >
              <button
                type="button"
                disabled={disabled || own}
                onClick={() => choose(option.id)}
                aria-pressed={award > 0}
                className={cn(
                  "flex min-h-[56px] min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left touch-manipulation",
                  award === 3 && "bg-[#fbf6ea]",
                  award === 2 && "bg-neutral-50",
                  award === 1 && "bg-neutral-50",
                  !award && !own && "active:bg-neutral-50",
                  own && "cursor-not-allowed",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[15px] font-medium leading-snug", own ? "text-neutral-400" : "text-neutral-900")}>
                    {option.label}
                  </span>
                  {option.people ? (
                    <span className="mt-0.5 block text-xs leading-snug text-neutral-500">{option.people}</span>
                  ) : null}
                </span>
                {own ? (
                  <span className="shrink-0 rounded-full bg-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
                    Your team
                  </span>
                ) : null}
                {award > 0 ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white",
                      award === 3 ? "bg-[#1a140c]" : "bg-neutral-800",
                    )}
                  >
                    {AWARD[award]}
                  </span>
                ) : null}
              </button>
              {option.url && !own ? (
                <a
                  href={option.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex size-10 shrink-0 items-center justify-center text-neutral-800"
                  aria-label={`${option.label} on GitHub`}
                >
                  <Github className="size-5" />
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PointSlot({
  points,
  title,
  project,
  tone,
  onClear,
}: {
  points: 1 | 2 | 3;
  title: string;
  project: PollOption | null;
  tone: "gold" | "mid" | "ink";
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      disabled={!project}
      className={cn(
        "min-h-[104px] rounded-2xl border px-2 py-2.5 text-left touch-manipulation",
        tone === "gold" && "border-[#e4c27a] bg-[#fbf6ea]",
        tone === "mid" && "border-black/10 bg-[#f7f6f3]",
        tone === "ink" && "border-black/10 bg-white",
        !project && "cursor-default",
      )}
      aria-label={
        project
          ? `${points} ${points === 1 ? "point" : "points"} on ${project.label}. Tap to clear.`
          : `${points} ${points === 1 ? "point" : "points"} still to give`
      }
    >
      <p className="flex items-baseline gap-1 text-[#1a140c]">
        <span className="font-heading text-[1.65rem] font-bold leading-none tabular-nums">{points}</span>
        <span className="text-[11px] font-semibold">{points === 1 ? "point" : "points"}</span>
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{title}</p>
      <p className={cn("mt-1 line-clamp-2 text-xs leading-snug", project ? "font-medium text-neutral-900" : "text-neutral-400")}>
        {project ? project.label : "Tap below"}
      </p>
    </button>
  );
}
