/**
 * EventCard — mirrors the FellowCard visual language from the map page:
 * white card, subtle border + shadow, colored pill badges, generous spacing.
 */

import { useState, useMemo } from "react";
import { Calendar, MapPin, ChevronDown, Users, ExternalLink } from "lucide-react";
import { NodeEvent, RSVPStatus, RSVPSummary } from "../../types/events";
import { Person } from "../../types";
import { RSVPButtonGroup } from "./RSVPButtonGroup";
import { AttendanceAvatars } from "./AttendanceAvatars";
import { cn } from "../ui/utils";

/** Show "Read more" when description might wrap beyond two lines. */
const READ_MORE_THRESHOLD = 80;

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  coworking:    { bg: "bg-sky-100",    text: "text-sky-700" },
  workshop:     { bg: "bg-amber-100",  text: "text-amber-700" },
  conference:   { bg: "bg-indigo-100", text: "text-indigo-700" },
  launch:       { bg: "bg-teal-100",   text: "text-teal-700" },
  "open-house": { bg: "bg-violet-100", text: "text-violet-700" },
  demo:         { bg: "bg-orange-100", text: "text-orange-700" },
  social:       { bg: "bg-pink-100",   text: "text-pink-700" },
  flagship:     { bg: "bg-rose-100",   text: "text-rose-700" },
  other:        { bg: "bg-gray-100",   text: "text-gray-600" },
};

function badgeStyle(type: string) {
  return TYPE_BADGE[type] ?? TYPE_BADGE.other;
}

function typeLabel(t: string) {
  return t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(startAt: string, endAt: string) {
  const s = new Date(startAt);
  const e = new Date(endAt);
  const sameDay = s.toDateString() === e.toDateString();
  const tOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const dOpts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };

  if (sameDay) {
    return {
      date: s.toLocaleDateString("en-US", dOpts),
      time: `${s.toLocaleTimeString("en-US", tOpts)} – ${e.toLocaleTimeString("en-US", tOpts)}`,
    };
  }
  return {
    date: `${s.toLocaleDateString("en-US", dOpts)} – ${e.toLocaleDateString("en-US", dOpts)}`,
    time: null,
  };
}

interface EventCardProps {
  event: NodeEvent;
  rsvpSummary: RSVPSummary;
  currentUserStatus: RSVPStatus | null;
  onRSVPChange: (eventId: string, status: RSVPStatus | null) => void;
  onShowOnMap?: (eventId: string) => void;
  allPeople: Person[];
  isAuthenticated: boolean;
}

export function EventCard({
  event,
  rsvpSummary,
  currentUserStatus,
  onRSVPChange,
  allPeople,
  isAuthenticated,
}: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const badge = badgeStyle(event.type);
  const { date, time } = formatTime(event.startAt, event.endAt);

  const goingPeople = useMemo(
    () => allPeople.filter((p) => rsvpSummary.goingPersonIds.includes(p.id)),
    [allPeople, rsvpSummary.goingPersonIds],
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 sm:p-7">
      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", badge.bg, badge.text)}>
          {typeLabel(event.type)}
        </span>
        {event.visibility === "public" && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            Public
          </span>
        )}
        {event.capacity !== null && (
          <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
            <Users className="size-3.5" />
            {event.capacity} spots
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-snug mb-3">
        {event.title}
      </h3>

      {/* Date & location */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5 text-sm text-gray-500 mb-4">
        <span className="inline-flex items-center gap-2">
          <Calendar className="size-4 text-gray-400 flex-shrink-0" />
          <span>{date}{time ? ` · ${time}` : ""}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <MapPin className="size-4 text-gray-400 flex-shrink-0" />
          <span>{event.location}</span>
        </span>
      </div>

      {/* Description */}
      {event.description && (
        <div className="mb-4">
          <p
            className={cn(
              "text-sm text-gray-600 leading-relaxed",
              !expanded && "line-clamp-2",
            )}
          >
            {event.description}
          </p>
          {event.description.length >= READ_MORE_THRESHOLD && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setExpanded((prev) => !prev);
              }}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 rounded"
            >
              {expanded ? "Show less" : "Read more"}
              <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </div>
      )}

      {/* External registration link (e.g. Luma) — easy place to add event URL */}
      {event.externalLink && (
        <div className="mb-4">
          <a
            href={event.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
          >
            <ExternalLink className="size-4" />
            Register on Luma
          </a>
        </div>
      )}

      {/* RSVP section */}
      {(isAuthenticated || goingPeople.length > 0) && (
        <div className="pt-4 mt-1 border-t border-gray-100 space-y-3">
          {isAuthenticated && (
            <RSVPButtonGroup
              currentStatus={currentUserStatus}
              onStatusChange={(s) => onRSVPChange(event.id, s)}
              goingCount={rsvpSummary.going}
              interestedCount={rsvpSummary.interested}
            />
          )}
          {goingPeople.length > 0 && (
            <AttendanceAvatars people={goingPeople} />
          )}
        </div>
      )}
    </div>
  );
}
