import { getApiBase } from "./api-base";
import type { NodeSlug } from "../types/events";

type CalendarSource = "google" | "mock";

export interface SharedCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  invitedBy: string | null;
  description: string | null;
  externalLink: string | null;
  source: CalendarSource;
}

export interface SharedCalendarResult {
  source: CalendarSource;
  warning?: string;
  events: SharedCalendarEvent[];
  /**
   * True when the backing Google Calendar for this node isn't configured yet
   * (no calendar ID + no read credentials). We treat this as a friendly
   * "calendar coming soon" state rather than a hard error so the page doesn't
   * scream red banners at users on a fresh deploy.
   */
  notConfigured?: boolean;
}

const cacheByNode: Partial<Record<NodeSlug, SharedCalendarResult>> = {};

function sortByStart(events: SharedCalendarEvent[]): SharedCalendarEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}

function normalizeApiEvent(raw: unknown): SharedCalendarEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  const start = typeof candidate.start === "string" ? candidate.start.trim() : "";
  const end = typeof candidate.end === "string" ? candidate.end.trim() : "";
  if (!id || !start || !end) return null;

  return {
    id,
    title: title || "Untitled event",
    start,
    end,
    location:
      typeof candidate.location === "string" && candidate.location.trim()
        ? candidate.location.trim()
        : null,
    invitedBy:
      typeof candidate.invitedBy === "string" && candidate.invitedBy.trim()
        ? candidate.invitedBy.trim()
        : null,
    description:
      typeof candidate.description === "string" && candidate.description.trim()
        ? candidate.description.trim()
        : null,
    externalLink:
      typeof candidate.externalLink === "string" && candidate.externalLink.trim()
        ? candidate.externalLink.trim()
        : null,
    source: candidate.source === "google" ? "google" : "mock",
  };
}

export async function getSharedCalendarEvents(
  nodeSlug: NodeSlug,
): Promise<SharedCalendarResult> {
  try {
    const params = new URLSearchParams({ nodeSlug });
    const response = await fetch(`${getApiBase()}/calendar-events?${params}`);
    if (!response.ok) {
      // 503 is reserved for "Google Calendar is not configured yet". Treat it as
      // a friendly empty state so unsigned deploys don't look broken.
      if (response.status === 503) {
        const friendly: SharedCalendarResult = {
          source: "mock",
          events: [],
          notConfigured: true,
        };
        cacheByNode[nodeSlug] = friendly;
        return friendly;
      }

      let detail = "";
      try {
        const payload = await response.json();
        detail =
          payload && typeof payload === "object" && typeof payload.error === "string"
            ? payload.error
            : "";
      } catch {
        // Ignore parse errors and use fallback path.
      }
      throw new Error(detail || `Calendar API request failed (${response.status}).`);
    }

    const payload = (await response.json()) as {
      source?: string;
      warning?: string;
      events?: unknown[];
    };
    const events = sortByStart((payload.events || []).map(normalizeApiEvent).filter(Boolean) as SharedCalendarEvent[]);
    const result: SharedCalendarResult = {
      source: payload.source === "google" ? "google" : "mock",
      warning: typeof payload.warning === "string" ? payload.warning : undefined,
      events,
    };
    cacheByNode[nodeSlug] = result;
    return result;
  } catch (error) {
    if (cacheByNode[nodeSlug]) return cacheByNode[nodeSlug] as SharedCalendarResult;
    throw error instanceof Error
      ? error
      : new Error("Failed to load shared calendar events.");
  }
}
