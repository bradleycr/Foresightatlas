import type { NodeEvent } from "../types/events";

/** Treat an event as past once its scheduled end has passed. */
export function getEventEndMs(event: Pick<NodeEvent, "startAt" | "endAt">): number {
  const end = new Date(event.endAt).getTime();
  if (Number.isFinite(end)) return end;
  const start = new Date(event.startAt);
  start.setHours(23, 59, 59, 999);
  return start.getTime();
}

export function isEventUpcoming(
  event: Pick<NodeEvent, "startAt" | "endAt">,
  now: Date = new Date(),
): boolean {
  return getEventEndMs(event) >= now.getTime();
}

export function isEventPast(
  event: Pick<NodeEvent, "startAt" | "endAt">,
  now: Date = new Date(),
): boolean {
  return !isEventUpcoming(event, now);
}

export function splitEventsByTiming<T extends Pick<NodeEvent, "startAt" | "endAt">>(
  events: T[],
  now: Date = new Date(),
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const event of events) {
    if (isEventUpcoming(event, now)) upcoming.push(event);
    else past.push(event);
  }
  upcoming.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  past.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  return { upcoming, past };
}

export function formatEventDateShort(startAt: string): string {
  return new Date(startAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
