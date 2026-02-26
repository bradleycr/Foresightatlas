/**
 * EventCard — mirrors the FellowCard visual language from the map page:
 * white card, subtle border + shadow, coloured pill badges, generous spacing.
 *
 * The CTA button and text links use the per-node NodeColorTheme so Berlin
 * gets violet–rose accents and SF gets amber–sky accents — no hardcoded teal.
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { Calendar, MapPin, ChevronDown, Users, ExternalLink, Ticket } from "lucide-react";
import { NodeEvent, NodeColorTheme, RSVPStatus, RSVPSummary } from "../../types/events";
import { Person } from "../../types";
import { RSVPButtonGroup } from "./RSVPButtonGroup";
import { AttendanceAvatars } from "./AttendanceAvatars";
import { cn } from "../ui/utils";
import { isLumaUrl, normalizeExternalUrl } from "../../utils/externalUrl";
import { badgeGradient } from "../../styles/gradients";

/** Only show "Read more" when the description is actually clamped (has overflow). */
const READ_MORE_MIN_LENGTH = 60;

const TYPE_BADGE: Record<string, { bg: string; text: string; gradient?: boolean }> = {
  coworking:    { bg: "bg-sky-100",    text: "text-sky-700" },
  workshop:     { bg: "bg-amber-100",  text: "text-amber-700" },
  conference:   { bg: "bg-indigo-100", text: "text-indigo-700" },
  launch:       { bg: "", text: "text-gray-800", gradient: true },
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
  onRSVPChange: (eventId: string, status: RSVPStatus | null, eventTitle?: string) => void;
  onShowOnMap?: (eventId: string) => void;
  allPeople: Person[];
  isAuthenticated: boolean;
  onPersonClick?: (personId: string) => void;
  theme: NodeColorTheme;
}

export function EventCard({
  event,
  rsvpSummary,
  currentUserStatus,
  onRSVPChange,
  allPeople,
  isAuthenticated,
  onPersonClick,
  theme,
}: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const badge = badgeStyle(event.type);
  const { date, time } = formatTime(event.startAt, event.endAt);
  const externalLink = normalizeExternalUrl(event.externalLink);
  const isLumaEvent = isLumaUrl(externalLink);

  const goingPeople = useMemo(
    () => allPeople.filter((p) => rsvpSummary.goingPersonIds.includes(p.id)),
    [allPeople, rsvpSummary.goingPersonIds],
  );

  useEffect(() => {
    if (!event.description || event.description.length < READ_MORE_MIN_LENGTH) {
      setIsClamped(false);
      return;
    }
    const el = descriptionRef.current;
    if (!el) return;
    const check = () => setIsClamped(el.scrollHeight > el.clientHeight);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [event.description, expanded]);

  return (
    <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 sm:p-7 overflow-hidden">
      {isLumaEvent && (
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: badgeGradient }} aria-hidden />
      )}
      {/* Badges row — comfortable padding so text isn’t cramped */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className={cn("px-3 py-1.5 rounded-full text-xs font-semibold", !badge.gradient && badge.bg, badge.text)} style={badge.gradient ? { background: badgeGradient } : undefined}>
          {typeLabel(event.type)}
        </span>
        {isLumaEvent && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            <Ticket className="size-3.5" />
            On Luma
          </span>
        )}
        {event.visibility === "public" && (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
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

      {/* Primary CTA: Luma / external link — so people can go straight to the event page */}
      {externalLink && (
        <div className="mb-4 mt-1">
          <a
            href={externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center justify-center gap-2.5 rounded-xl font-medium transition-all",
              "px-6 py-3.5 min-w-[11rem] text-sm sm:text-base",
              "focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm hover:shadow",
              theme.ctaBg, theme.ctaText, `border ${theme.ctaBorder}`,
              theme.ctaHover, theme.ctaFocusRing,
            )}
          >
            {isLumaEvent ? (
              <>
                <Ticket className="size-4 sm:size-5 flex-shrink-0" />
                View on Luma
              </>
            ) : (
              <>
                <ExternalLink className="size-4 sm:size-5 flex-shrink-0" />
                Get tickets
              </>
            )}
          </a>
        </div>
      )}

      {/* Description: always show full text in-app with Read more when long; external CTA is separate */}
      {event.description && (
        <div className="mb-4">
          <>
            <p
              ref={descriptionRef}
              className={cn(
                "text-sm text-gray-600 leading-relaxed",
                !expanded && "line-clamp-2",
              )}
            >
              {event.description}
            </p>
            {(isClamped || expanded) && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setExpanded((prev) => !prev);
                }}
                className={cn(
                  "mt-2 inline-flex items-center gap-1 text-sm font-medium rounded",
                  "focus:outline-none focus:ring-2 focus:ring-offset-1",
                  theme.linkText, theme.linkHover, theme.ctaFocusRing,
                )}
              >
                {expanded ? "Show less" : "Read more"}
                <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
              </button>
            )}
          </>
        </div>
      )}

      {/* RSVP section */}
      {(isAuthenticated || goingPeople.length > 0) && (
        <div className="pt-4 mt-1 border-t border-gray-100 space-y-3">
          {isAuthenticated && (
            <RSVPButtonGroup
              currentStatus={currentUserStatus}
              onStatusChange={(s) => onRSVPChange(event.id, s, event.title)}
              goingCount={rsvpSummary.going}
              interestedCount={rsvpSummary.interested}
              theme={theme}
            />
          )}
          {goingPeople.length > 0 && <AttendanceAvatars people={goingPeople} onPersonClick={onPersonClick} />}
        </div>
      )}
    </div>
  );
}
