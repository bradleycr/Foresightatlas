/**
 * Compact row of initial-circles for event attendees,
 * with tooltips on hover and an overflow "+N" indicator.
 */

import { Person } from "../../types";
import { cn } from "../ui/utils";
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
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const PALETTE = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
];

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function AttendanceAvatars({
  people,
  maxShow = 5,
  label = "going",
  size = "sm",
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
                  className={cn(
                    "rounded-full flex items-center justify-center font-semibold ring-2 ring-white cursor-default",
                    sz,
                    colorFor(p.id),
                  )}
                >
                  {initials(p.fullName)}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {p.fullName}
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
