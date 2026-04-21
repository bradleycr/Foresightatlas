import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, ExternalLink, Info } from "lucide-react";
import dayjs from "dayjs";
import { Calendar, dayjsLocalizer } from "react-big-calendar";
import type { Identity } from "../services/identity";
import type { Person, PrimaryNode } from "../types";
import { getSharedCalendarEvents, type SharedCalendarEvent } from "../services/googleCalendar";
import type { NodeSlug } from "../types/events";
import { getProgrammingPageConfig } from "../data/nodes";
import { Button } from "../components/ui/button";
import { isLumaUrl } from "../utils/externalUrl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

const localizer = dayjsLocalizer(dayjs);
const FALLBACK_INVITE_EMAIL = "user@foresight.com";
type CalendarView = "month" | "week" | "day" | "agenda";
const DEFAULT_VIEW: CalendarView = "month";

const NODE_FROM_PRIMARY: Record<PrimaryNode, NodeSlug> = {
  "Berlin Node": "berlin",
  "Bay Area Node": "sf",
  Global: "global",
  Alumni: "global",
};

interface CalendarPageProps {
  identity: Identity | null;
  signedInPerson: Person | null;
  onOpenProfile: () => void;
}

function getNodeSlugForPerson(person: Person | null): NodeSlug {
  if (!person) return "global";
  return NODE_FROM_PRIMARY[person.primaryNode] || "global";
}

function toCalendarEvent(event: SharedCalendarEvent) {
  return {
    title: event.title,
    start: new Date(event.start),
    end: new Date(event.end),
    allDay: false,
    resource: event,
  };
}

function isMeetingUrl(href: string | null | undefined): boolean {
  if (!href) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    return host === "meet.google.com" || host.endsWith(".teams.microsoft.com") || host === "teams.microsoft.com";
  } catch {
    return false;
  }
}

function getActionableEventLink(event: SharedCalendarEvent): string | null {
  if (!event.externalLink) return null;
  if (isLumaUrl(event.externalLink)) return event.externalLink;
  if (isMeetingUrl(event.externalLink)) return event.externalLink;
  return null;
}

function getEventLinkLabel(event: SharedCalendarEvent): string {
  if (event.externalLink && isLumaUrl(event.externalLink)) return "View on Luma";
  return "Join meeting";
}

export function CalendarPage({ identity, signedInPerson, onOpenProfile }: CalendarPageProps) {
  const inviteEmail = (import.meta.env.VITE_CALENDAR_INVITE_EMAIL || FALLBACK_INVITE_EMAIL).trim() || FALLBACK_INVITE_EMAIL;
  const nodeSlug = getNodeSlugForPerson(signedInPerson);
  const pageNode = getProgrammingPageConfig(nodeSlug);
  const [calendarEvents, setCalendarEvents] = useState([] as SharedCalendarEvent[]);
  const [source, setSource] = useState("mock" as "google" | "mock");
  const [warning, setWarning] = useState(null as string | null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [view, setView] = useState(DEFAULT_VIEW as CalendarView);
  const [selectedEvent, setSelectedEvent] = useState(null as SharedCalendarEvent | null);

  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setWarning(null);
    void getSharedCalendarEvents(nodeSlug)
      .then((result) => {
        if (cancelled) return;
        setCalendarEvents(result.events);
        setSource(result.source);
        setWarning(result.warning || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load calendar events.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [identity, nodeSlug]);

  const uiEvents = useMemo(() => calendarEvents.map(toCalendarEvent), [calendarEvents]);

  if (!identity) {
    return (
      <div className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white px-6 py-10 shadow-sm text-center">
          <CalendarDays className="mx-auto mb-4 size-8 text-gray-400" />
          <h1 className="text-xl font-semibold text-gray-900">Calendar is for signed-in members</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your profile to access your node&apos;s shared calendar.
          </p>
          <Button className="mt-6" onClick={onOpenProfile}>
            Open profile sign-in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 size-5 text-sky-600" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 sm:text-xl">
                {pageNode?.city || "Global"} Shared Calendar
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                Add events to this shared calendar by inviting{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-800">{inviteEmail}</code>{" "}
                to your Google Calendar event. Once invited, your event appears here for members in your node.
              </p>
            </div>
          </div>
        </div>

        {warning && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {warning}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <p className="text-sm text-gray-600">
              Showing {calendarEvents.length} event{calendarEvents.length === 1 ? "" : "s"} from{" "}
              <span className="font-medium text-gray-900">
                {source === "google" ? "Google Calendar" : "mock programming data"}
              </span>
              .
            </p>
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-800"
            >
              Open Google Calendar
              <ExternalLink className="size-3.5" />
            </a>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-100">
            <div className="h-[72vh] min-h-[520px] bg-white">
              <Calendar
                localizer={localizer}
                events={uiEvents}
                startAccessor="start"
                endAccessor="end"
                view={view}
                onView={setView}
                popup
                selectable={false}
                toolbar
                eventPropGetter={(event) => {
                  const data = event.resource as SharedCalendarEvent | undefined;
                  return {
                    style: {
                      backgroundColor: data?.source === "google" ? "#0ea5e9" : "#6366f1",
                      borderColor: "transparent",
                      color: "#ffffff",
                      borderRadius: "6px",
                    },
                  };
                }}
                onSelectEvent={(event) => {
                  const data = event.resource as SharedCalendarEvent | undefined;
                  setSelectedEvent(
                    data ?? {
                      id: `calendar-${event.title}-${event.start?.toISOString?.() ?? ""}`,
                      title: String(event.title || "Untitled event"),
                      start: event.start instanceof Date ? event.start.toISOString() : new Date().toISOString(),
                      end: event.end instanceof Date ? event.end.toISOString() : new Date().toISOString(),
                      location: null,
                      invitedBy: null,
                      description: null,
                      externalLink: null,
                      source: "mock",
                    },
                  );
                }}
              />
            </div>
          </div>
          {isLoading && <p className="mt-3 text-sm text-gray-500">Loading calendar events...</p>}
        </div>
      </div>

      <Dialog open={selectedEvent !== null} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-xl">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedEvent.title}</DialogTitle>
                <DialogDescription>
                  {dayjs(selectedEvent.start).format("ddd, MMM D, YYYY h:mm A")} -{" "}
                  {dayjs(selectedEvent.end).format("h:mm A")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <p>
                  <span className="font-medium text-gray-900">Starts:</span>{" "}
                  <span className="text-gray-700">
                    {dayjs(selectedEvent.start).format("ddd, MMM D, YYYY h:mm A")}
                  </span>
                </p>
                <p>
                  <span className="font-medium text-gray-900">Ends:</span>{" "}
                  <span className="text-gray-700">
                    {dayjs(selectedEvent.end).format("ddd, MMM D, YYYY h:mm A")}
                  </span>
                </p>
                {selectedEvent.location && (
                  <p>
                    <span className="font-medium text-gray-900">Location:</span>{" "}
                    <span className="text-gray-700">{selectedEvent.location}</span>
                  </p>
                )}
                {selectedEvent.invitedBy && (
                  <p>
                    <span className="font-medium text-gray-900">Invited by:</span>{" "}
                    <span className="text-gray-700">{selectedEvent.invitedBy}</span>
                  </p>
                )}
                {selectedEvent.description && (
                  <p>
                    <span className="font-medium text-gray-900">Description:</span>{" "}
                    <span className="text-gray-700 whitespace-pre-wrap">{selectedEvent.description}</span>
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  Source: {selectedEvent.source === "google" ? "Google Calendar" : "Programming/Luma mock"}
                </p>
              </div>

              <DialogFooter>
                {getActionableEventLink(selectedEvent) ? (
                  <Button asChild>
                    <a href={getActionableEventLink(selectedEvent) || "#"} target="_blank" rel="noopener noreferrer">
                      {getEventLinkLabel(selectedEvent)}
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => setSelectedEvent(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
