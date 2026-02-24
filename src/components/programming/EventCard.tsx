/**
 * EventCard — polished event display with clear visual hierarchy,
 * color-coded type system, and integrated RSVP controls.
 */

import { useState, useMemo } from "react";
import { Calendar, MapPin, ChevronDown, Users, ExternalLink } from "lucide-react";
import { NodeEvent, RSVPStatus, RSVPSummary } from "../../types/events";
import { Person } from "../../types";
import { RSVPButtonGroup } from "./RSVPButtonGroup";
import { AttendanceAvatars } from "./AttendanceAvatars";
import { cn } from "../ui/utils";

/* ── type styling system ────────────────────────────────────────────── */

const TYPE_CONFIG: Record<string, { accent: string; bg: string; text: string; dot: string }> = {
  coworking:    { accent: "border-l-sky-400",    bg: "bg-sky-50",    text: "text-sky-700",    dot: "bg-sky-400" },
  workshop:     { accent: "border-l-amber-400",  bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-400" },
  conference:   { accent: "border-l-indigo-400", bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-400" },
  launch:       { accent: "border-l-teal-500",   bg: "bg-teal-50",   text: "text-teal-700",   dot: "bg-teal-500" },
  "open-house": { accent: "border-l-violet-400", bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-400" },
  demo:         { accent: "border-l-orange-400", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400" },
  social:       { accent: "border-l-pink-400",   bg: "bg-pink-50",   text: "text-pink-700",   dot: "bg-pink-400" },
  flagship:     { accent: "border-l-rose-400",   bg: "bg-rose-50",   text: "text-rose-700",   dot: "bg-rose-400" },
  other:        { accent: "border-l-gray-300",   bg: "bg-gray-50",   text: "text-gray-600",   dot: "bg-gray-400" },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.other;
}

/* ── date formatting ────────────────────────────────────────────────── */

function formatEventDate(startAt: string, endAt: string) {
  const s = new Date(startAt);
  const e = new Date(endAt);
  const sameDay = s.toDateString() === e.toDateString();

  const dayOpts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

  const dateStr = s.toLocaleDateString("en-US", dayOpts);
  const dayNum = s.getDate();
  const month = s.toLocaleDateString("en-US", { month: "short" });
  const weekday = s.toLocaleDateString("en-US", { weekday: "short" });

  if (sameDay) {
    const startTime = s.toLocaleTimeString("en-US", timeOpts);
    const endTime = e.toLocaleTimeString("en-US", timeOpts);
    return { dateStr, timeStr: `${startTime} – ${endTime}`, dayNum, month, weekday, multiDay: false };
  }

  const endDateStr = e.toLocaleDateString("en-US", dayOpts);
  return { dateStr, timeStr: endDateStr, dayNum, month, weekday, multiDay: true };
}

function typeLabel(t: string) {
  return t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── component ───────────────────────────────────────────────────────── */

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

  const config = getTypeConfig(event.type);
  const { dayNum, month, weekday, timeStr, multiDay } = formatEventDate(event.startAt, event.endAt);

  const goingPeople = useMemo(
    () => allPeople.filter((p) => rsvpSummary.goingPersonIds.includes(p.id)),
    [allPeople, rsvpSummary.goingPersonIds],
  );

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-100 border-l-4 overflow-hidden",
        "hover:shadow-md hover:border-gray-200 transition-all duration-200",
        config.accent,
      )}
    >
      <div className="flex gap-0">
        {/* Date column — visual anchor */}
        <div className="hidden sm:flex flex-col items-center justify-start pt-6 px-5 flex-shrink-0 min-w-[72px]">
          <span className="text-xs font-medium text-gray-400 uppercase">{weekday}</span>
          <span className="text-2xl font-bold text-gray-900 leading-none mt-1">{dayNum}</span>
          <span className="text-xs font-medium text-gray-400 uppercase mt-0.5">{month}</span>
        </div>

        {/* Content column */}
        <div className="flex-1 p-5 sm:pl-0 sm:pr-6 sm:py-5 space-y-4">
          {/* Top row: type badge + meta */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold",
              config.bg, config.text,
            )}>
              <span className={cn("size-1.5 rounded-full", config.dot)} />
              {typeLabel(event.type)}
            </span>
            {event.visibility === "public" && (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                Public
              </span>
            )}
            {multiDay && (
              <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-md">
                Multi-day
              </span>
            )}
            {event.capacity !== null && (
              <span className="text-xs text-gray-400 flex items-center gap-1 ml-auto">
                <Users className="size-3.5" />
                {event.capacity} spots
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 leading-snug font-heading">
            {event.title}
          </h3>

          {/* When & where — compact row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5 text-gray-400" />
              {/* Mobile shows inline date */}
              <span className="sm:hidden">{new Date(event.startAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · </span>
              {timeStr}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5 text-gray-400" />
              {event.location}
            </span>
            {event.externalLink && (
              <a
                href={event.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium"
              >
                <ExternalLink className="size-3.5" />
                Details
              </a>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div>
              <p className={cn(
                "text-sm text-gray-600 leading-relaxed",
                !expanded && "line-clamp-2",
              )}>
                {event.description}
              </p>
              {event.description.length > 120 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
                >
                  {expanded ? "Show less" : "Read more"}
                  <ChevronDown className={cn("size-3.5 transition-transform duration-200", expanded && "rotate-180")} />
                </button>
              )}
            </div>
          )}

          {/* RSVP + attendance */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            {isAuthenticated ? (
              <RSVPButtonGroup
                currentStatus={currentUserStatus}
                onStatusChange={(s) => onRSVPChange(event.id, s)}
                goingCount={rsvpSummary.going}
                interestedCount={rsvpSummary.interested}
              />
            ) : (
              rsvpSummary.going === 0 && rsvpSummary.interested === 0 && (
                <p className="text-xs text-gray-400 italic">
                  Select your name above to RSVP
                </p>
              )
            )}
            {goingPeople.length > 0 && (
              <AttendanceAvatars people={goingPeople} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
