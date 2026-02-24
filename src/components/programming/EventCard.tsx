/**
 * EventCard — matches the FellowCard visual language of the main app.
 * White card, subtle border, teal CTA, clean type hierarchy.
 */

import { useState, useMemo } from "react";
import { Calendar, MapPin, ChevronDown, Users } from "lucide-react";
import { NodeEvent, RSVPStatus, RSVPSummary } from "../../types/events";
import { Person } from "../../types";
import { RSVPButtonGroup } from "./RSVPButtonGroup";
import { AttendanceAvatars } from "./AttendanceAvatars";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { cn } from "../ui/utils";

/* ── type colours (left accent bar only) ────────────────────────────── */

const TYPE_ACCENT: Record<string, string> = {
  coworking:   "border-l-sky-400",
  workshop:    "border-l-amber-400",
  conference:  "border-l-indigo-400",
  launch:      "border-l-teal-500",
  "open-house":"border-l-violet-400",
  demo:        "border-l-orange-400",
  social:      "border-l-pink-400",
  flagship:    "border-l-rose-400",
  other:       "border-l-gray-300",
};

const TYPE_BADGE: Record<string, string> = {
  coworking:   "bg-sky-50 text-sky-700 border-sky-200",
  workshop:    "bg-amber-50 text-amber-700 border-amber-200",
  conference:  "bg-indigo-50 text-indigo-700 border-indigo-200",
  launch:      "bg-teal-50 text-teal-700 border-teal-200",
  "open-house":"bg-violet-50 text-violet-700 border-violet-200",
  demo:        "bg-orange-50 text-orange-700 border-orange-200",
  social:      "bg-pink-50 text-pink-700 border-pink-200",
  flagship:    "bg-rose-50 text-rose-700 border-rose-200",
  other:       "bg-gray-50 text-gray-500 border-gray-200",
};

/* ── date helpers ────────────────────────────────────────────────────── */

function fmtDate(startAt: string, endAt: string): string {
  const s = new Date(startAt);
  const e = new Date(endAt);
  const sameDay = s.toDateString() === e.toDateString();
  const d: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  const t: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  if (sameDay) {
    return `${s.toLocaleDateString("en-US", d)} · ${s.toLocaleTimeString("en-US", t)} – ${e.toLocaleTimeString("en-US", t)}`;
  }
  return `${s.toLocaleDateString("en-US", d)} – ${e.toLocaleDateString("en-US", d)}`;
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

  const accent = TYPE_ACCENT[event.type] ?? TYPE_ACCENT.other;
  const badgeCls = TYPE_BADGE[event.type] ?? TYPE_BADGE.other;
  const multiDay =
    new Date(event.startAt).toDateString() !== new Date(event.endAt).toDateString();

  const goingPeople = useMemo(
    () => allPeople.filter((p) => rsvpSummary.goingPersonIds.includes(p.id)),
    [allPeople, rsvpSummary.goingPersonIds],
  );

  return (
    <Card
      className={cn(
        "p-5 sm:p-6 border-l-4 transition-all hover:shadow-lg border border-gray-100 bg-app-card",
        accent,
      )}
    >
      <div className="space-y-5">
        {/* ── badges ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Badge variant="outline" className={cn("text-xs font-medium", badgeCls)}>
            {typeLabel(event.type)}
          </Badge>
          {event.visibility === "public" && (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              Public
            </Badge>
          )}
          {multiDay && (
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
              Multi-day
            </Badge>
          )}
          {event.capacity !== null && (
            <span className="text-xs text-gray-500 flex items-center gap-1.5">
              <Users className="size-3.5" />
              {event.capacity}
            </span>
          )}
        </div>

        {/* ── title ───────────────────────────────────────────── */}
        <h3 className="text-gray-900 leading-snug mt-0.5 font-heading">
          {event.title}
        </h3>

        {/* ── when & where ────────────────────────────────────── */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-0.5">
          <span className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="size-4 text-gray-400 flex-shrink-0" />
            {fmtDate(event.startAt, event.endAt)}
          </span>
          <span className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="size-4 text-gray-400 flex-shrink-0" />
            {event.location}
          </span>
        </div>

        {/* ── description ─────────────────────────────────────── */}
        {event.description && (
          <div className="space-y-2 mt-0.5">
            <p className={cn("text-sm text-gray-700 leading-[1.6]", !expanded && "line-clamp-2")}>
              {event.description}
            </p>
            {event.description.length > 100 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors py-0.5"
              >
                {expanded ? "Show less" : "Read more"}
                <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
              </button>
            )}
          </div>
        )}

        {/* ── RSVP + attendance ───────────────────────────────── */}
        <div className="pt-5 mt-1 border-t border-gray-100 space-y-4">
          {isAuthenticated && (
            <RSVPButtonGroup
              currentStatus={currentUserStatus}
              onStatusChange={(s) => onRSVPChange(event.id, s)}
              goingCount={rsvpSummary.going}
              interestedCount={rsvpSummary.interested}
            />
          )}
          {goingPeople.length > 0 && (
            <div className="pt-1">
              <AttendanceAvatars people={goingPeople} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
