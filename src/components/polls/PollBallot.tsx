/**
 * A points ballot, not a podium.
 *
 * Two points go to one project, one point to another. The slots at the top
 * say that in words. A bare 1 or 2 reads as first and second place, so the
 * rows never show a number on its own.
 */

import { Github } from "lucide-react";
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
  const favourite = options.find((option) => option.id === firstId) ?? null;
  const runnerUp = options.find((option) => option.id === secondId) ?? null;

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
    <div>
      <div className="grid grid-cols-2 gap-2">
        <PointSlot
          points={2}
          title="Favourite"
          project={favourite}
          tone="gold"
          onClear={() => onChange({ firstId: null, secondId })}
        />
        <PointSlot
          points={1}
          title="Runner-up"
          project={runnerUp}
          tone="ink"
          onClear={() => onChange({ firstId, secondId: null })}
        />
      </div>
      <p className="mt-2 text-center text-[11px] text-neutral-500">
        Tap a project to give it points. Tap it again to take them back.
      </p>
      <ul className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-white">
        {options.map((option) => {
          const award = option.id === firstId ? 2 : option.id === secondId ? 1 : 0;
          return (
            <li key={option.id} className="border-b border-black/5 last:border-b-0">
              <button
                type="button"
                disabled={disabled}
                onClick={() => choose(option.id)}
                aria-pressed={award > 0}
                className={cn(
                  "flex min-h-[56px] w-full items-center gap-3 px-3.5 py-3 text-left touch-manipulation",
                  award === 2 && "bg-[#fbf6ea]",
                  award === 1 && "bg-neutral-50",
                  !award && "active:bg-neutral-50",
                )}
              >
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
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-800"
                    aria-label={`${option.label} on GitHub`}
                  >
                    <Github className="size-5" />
                  </a>
                ) : null}
                {award > 0 ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      award === 2 ? "bg-[#1a140c] text-[#f6f1e7]" : "bg-neutral-800 text-white",
                    )}
                  >
                    {award === 2 ? "2 points" : "1 point"}
                  </span>
                ) : null}
              </button>
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
  points: 1 | 2;
  title: string;
  project: PollOption | null;
  tone: "gold" | "ink";
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      disabled={!project}
      className={cn(
        "min-h-[108px] rounded-2xl border px-3 py-3 text-left touch-manipulation",
        tone === "gold" ? "border-[#e4c27a] bg-[#fbf6ea]" : "border-black/10 bg-white",
        !project && "cursor-default",
      )}
      aria-label={
        project
          ? `${points} ${points === 1 ? "point" : "points"} on ${project.label}. Tap to clear.`
          : `${points} ${points === 1 ? "point" : "points"} still to give`
      }
    >
      <p className="flex items-baseline gap-1.5 text-[#1a140c]">
        <span className="font-heading text-[2rem] font-bold leading-none tabular-nums">{points}</span>
        <span className="text-sm font-semibold">{points === 1 ? "point" : "points"}</span>
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
        {title}
      </p>
      <p className={cn("mt-1 line-clamp-2 text-sm leading-snug", project ? "font-medium text-neutral-900" : "text-neutral-400")}>
        {project ? project.label : "Tap a project below"}
      </p>
    </button>
  );
}
