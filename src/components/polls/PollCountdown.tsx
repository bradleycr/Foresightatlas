/**
 * The room's last minute. The host starts it; every screen counts the same clock.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "../ui/utils";

interface PollCountdownProps {
  closesAt: string;
  onElapsed?: () => void;
  size?: "stage" | "phone" | "inline";
}

function secondsLeft(closesAt: string) {
  const due = Date.parse(closesAt);
  if (!Number.isFinite(due)) return 0;
  return Math.max(0, Math.ceil((due - Date.now()) / 1000));
}

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PollCountdown({ closesAt, onElapsed, size = "phone" }: PollCountdownProps) {
  const [left, setLeft] = useState(() => secondsLeft(closesAt));
  const onElapsedRef = useRef(onElapsed);
  onElapsedRef.current = onElapsed;

  useEffect(() => {
    let fired = false;
    const tick = () => {
      const next = secondsLeft(closesAt);
      setLeft(next);
      if (next === 0 && !fired) {
        fired = true;
        onElapsedRef.current?.();
      }
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [closesAt]);

  if (!Number.isFinite(Date.parse(closesAt))) return null;

  return (
    <p
      className={cn(
        "font-heading font-bold tabular-nums leading-none",
        size === "stage" && "text-4xl sm:text-6xl md:text-7xl",
        size === "phone" && "text-5xl",
        size === "inline" && "text-2xl",
      )}
      aria-live="polite"
    >
      <span className="sr-only">Final minute </span>
      {clock(left)}
    </p>
  );
}
