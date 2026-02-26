/**
 * Compact row of initial-circles for event attendees,
 * with tooltips on hover and an overflow "+N" indicator.
 */

import { Person } from "../../types";
import { cn } from "../ui/utils";
import { getRoleGradient } from "../../styles/roleColors";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface AttendanceAvatarsProps {
  people: Person[];
  maxShow?: number;
  label?: string;
  size?: "sm" | "md";
  onPersonClick?: (personId: string) => void;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AttendanceAvatars({
  people,
  maxShow = 5,
  label = "going",
  size = "sm",
  onPersonClick,
}: AttendanceAvatarsProps) {
  if (people.length === 0) return null;

  const shown = people.slice(0, maxShow);
  const overflow = people.length - maxShow;
  const sz = size === "sm" ? "size-7 text-[10px]" : "size-8 text-xs";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5">
        <div className="flex -space-x-1.5">
          {shown.map((p) => (
            <Tooltip key={p.id}>
              <TooltipTrigger asChild>
                <div
                  role={onPersonClick ? "button" : undefined}
                  tabIndex={onPersonClick ? 0 : undefined}
                  onClick={onPersonClick ? () => onPersonClick(p.id) : undefined}
                  onKeyDown={
                    onPersonClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onPersonClick(p.id);
                          }
                        }
                      : undefined
                  }
                  aria-label={onPersonClick ? `View profile for ${p.fullName}` : p.fullName}
                  className={cn(
                    "rounded-full flex items-center justify-center font-semibold select-none",
                    "ring-2 ring-white/90 shadow-sm border border-white/80",
                    "text-gray-900",
                    onPersonClick
                      ? "cursor-pointer hover:scale-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-1 transition-transform"
                      : "cursor-default",
                    sz,
                  )}
                  style={{
                    background: getRoleGradient(p.roleType),
                    textShadow: "0 0 1px rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.08)",
                  }}
                >
                  {initials(p.fullName)}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" theme="light" className="text-xs">
                <div className="flex flex-col gap-0.5">
                  {onPersonClick ? (
                    <button
                      type="button"
                      onClick={() => onPersonClick(p.id)}
                      className="text-left font-semibold text-gray-700"
                    >
                      {p.fullName}
                    </button>
                  ) : (
                    <span className="font-semibold text-gray-700">{p.fullName}</span>
                  )}
                  <span className="text-[11px] text-gray-500">{p.roleType}</span>
                  {onPersonClick && (
                    <span className="text-[11px] text-gray-500">View profile</span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
          {overflow > 0 && (
            <div
              className={cn(
                "rounded-full flex items-center justify-center font-semibold ring-2 ring-white bg-gray-100 text-gray-600",
                sz,
              )}
            >
              +{overflow}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {people.length} {label}
        </span>
      </div>
    </TooltipProvider>
  );
}
