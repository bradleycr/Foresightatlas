import { useEffect, useState } from "react";
import { toDateKey } from "../services/checkin";

/**
 * Local-calendar "today" (YYYY-MM-DD), refreshed when the tab becomes visible
 * again so a long-lived session doesn't stick on yesterday after midnight.
 */
export function useTodayKey(): string {
  const [today, setToday] = useState(() => toDateKey(new Date()));

  useEffect(() => {
    const bump = () => {
      const next = toDateKey(new Date());
      setToday((prev) => (prev === next ? prev : next));
    };
    document.addEventListener("visibilitychange", bump);
    return () => document.removeEventListener("visibilitychange", bump);
  }, []);

  return today;
}
