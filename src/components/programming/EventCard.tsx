/**
 * EventCard — mirrors the FellowCard visual language from the map page:
 * white card, subtle border + shadow, coloured pill badges, generous spacing.
 *
 * The CTA button and text links use the per-node NodeColorTheme so Berlin
 * gets indigo–rose accents and SF gets amber–sky accents — no hardcoded teal.
 */

import { useState, useMemo, useRef, useEffect, type SyntheticEvent } from "react";
import { Calendar, MapPin, ChevronDown, Users, ExternalLink, Ticket } from "lucide-react";
import { NodeEvent, NodeColorTheme, RSVPStatus, RSVPSummary } from "../../types/events";
import { Person } from "../../types";
import { RSVPButtonGroup } from "./RSVPButtonGroup";
import { AttendanceAvatars } from "./AttendanceAvatars";
import { cn } from "../ui/utils";
import { isLumaUrl, normalizeExternalUrl } from "../../utils/externalUrl";
import { badgeGradient } from "../../styles/gradients";
import { formatEventDescriptionToHtml } from "./eventDescription";
import { BERLIN_RESIDENTS_DAY_RECURRENCE_GROUP_ID } from "../../data/events";

/** Show "Read more" when description is clamped (overflow) or when it's long enough that it likely wraps (fallback for HTML content). */
const READ_MORE_MIN_LENGTH = 60;
const READ_MORE_LENGTH_FALLBACK = 160;

/** Wide landscape covers stay as a top banner; square-ish art (typical Luma thumbnails) uses a small tile so nothing is cropped. */
const COVER_WIDE_ASPECT_THRESHOLD = 1.4;

type CoverLayoutMode = "banner" | "square";

/**
 * Renders the optional event cover: panoramic images fill the top band; square or
 * portrait images sit in a fixed square at the top-right with `object-contain` so
 * the full artwork is always visible. Until dimensions are known we assume square
 * (typical Luma thumbnail) to avoid a wide crop flash.
 */
function EventCoverImage({
  url,
  onLayout,
}: {
  url: string;
  onLayout: (mode: CoverLayoutMode) => void;
}) {
  const [layout, setLayout] = useState<CoverLayoutMode | null>(null);

  const handleLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (!w || !h) return;
    const mode: CoverLayoutMode = w / h >= COVER_WIDE_ASPECT_THRESHOLD ? "banner" : "square";
    setLayout(mode);
    onLayout(mode);
  };

  const isBanner = layout === "banner";

  return isBanner ? (
    <div className="absolute inset-x-0 top-0 h-32 sm:h-40 overflow-hidden">
      <img
        src={url}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent pointer-events-none"
        aria-hidden
      />
    </div>
  ) : (
    /* Square tile: previous sizing (5.5rem / 7rem) felt stamp-like — this
     * gives the Luma artwork room to breathe without crowding the title. */
    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 size-24 sm:size-36 rounded-xl overflow-hidden border border-gray-200/90 bg-gray-50 shadow-sm ring-1 ring-black/5">
      <img
        src={url}
        alt=""
        className="size-full object-contain object-center"
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
      />
    </div>
  );
}

const TYPE_BADGE: Record<string, { bg: string; text: string; gradient?: boolean }> = {
  coworking:    { bg: "bg-sky-100",    text: "text-sky-700" },
  workshop:     { bg: "bg-amber-100",  text: "text-amber-700" },
  conference:   { bg: "bg-indigo-100", text: "text-indigo-700" },
  launch:       { bg: "", text: "text-gray-800", gradient: true },
  "open-house": { bg: "bg-indigo-100", text: "text-indigo-700" },
  demo:         { bg: "bg-orange-100", text: "text-orange-700" },
  social:       { bg: "bg-pink-100",   text: "text-pink-700" },
  flagship:     { bg: "bg-rose-100",   text: "text-rose-700" },
  "vision-weekend": { bg: "bg-violet-100", text: "text-violet-700" },
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
  /** `null` until the cover image loads — we default to square layout (typical Luma art). */
  const [coverLayout, setCoverLayout] = useState<CoverLayoutMode | null>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const badge = badgeStyle(event.type);
  const { date, time } = formatTime(event.startAt, event.endAt);
  const externalLink = normalizeExternalUrl(event.externalLink);
  const isLumaEvent = isLumaUrl(externalLink);
  /** Injected weekly Berlin resident day — calmer card, no “Read more” theatrics. */
  const isRoutineResidentsDay =
    event.recurrenceGroupId === BERLIN_RESIDENTS_DAY_RECURRENCE_GROUP_ID;

  const showReadMore =
    !isRoutineResidentsDay &&
    event.description &&
    event.description.length >= READ_MORE_MIN_LENGTH &&
    (isClamped || expanded || event.description.length >= READ_MORE_LENGTH_FALLBACK);

  const goingPeople = useMemo(
    () => allPeople.filter((p) => rsvpSummary.goingPersonIds.includes(p.id)),
    [allPeople, rsvpSummary.goingPersonIds],
  );
  const interestedPeople = useMemo(
    () => allPeople.filter((p) => rsvpSummary.interestedPersonIds.includes(p.id)),
    [allPeople, rsvpSummary.interestedPersonIds],
  );

  const showRsvpSection =
    isAuthenticated ||
    rsvpSummary.going > 0 ||
    rsvpSummary.interested > 0;

  useEffect(() => {
    if (isRoutineResidentsDay) {
      setIsClamped(false);
      return;
    }
    if (!event.description || event.description.length < READ_MORE_MIN_LENGTH) {
      setIsClamped(false);
      return;
    }
    const el = descriptionRef.current;
    if (!el) return;
    const check = () => setIsClamped(el.scrollHeight > el.clientHeight);
    check();
    let rafId = 0;
    let timeoutId = 0;
    rafId = requestAnimationFrame(() => {
      check();
      timeoutId = window.setTimeout(check, 150);
    });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      ro.disconnect();
    };
  }, [event.description, expanded, isRoutineResidentsDay]);

  useEffect(() => {
    setCoverLayout(null);
  }, [event.coverImageUrl, event.id]);

  return (
    <div
      className={cn(
        "relative rounded-2xl border transition-shadow p-6 sm:p-7 overflow-hidden",
        isRoutineResidentsDay
          ? "bg-stone-50/95 border-stone-200/90 shadow-sm hover:shadow-md"
          : "bg-white border-gray-200 shadow hover:shadow-lg",
      )}
    >
      {/* Optional cover: wide → top banner; square-ish → small top-right tile, full image visible */}
      {event.coverImageUrl && (
        <EventCoverImage url={event.coverImageUrl} onLayout={setCoverLayout} />
      )}
      <div
        className={cn(
          event.coverImageUrl && coverLayout === "banner" && "pt-28 sm:pt-36",
          /* Right padding = thumbnail size (6rem / 9rem) + its inset (0.75rem / 1rem) + gutter. */
          event.coverImageUrl && coverLayout !== "banner" &&
            "pr-[7.25rem] sm:pr-[10.5rem]",
        )}
      >
      {isLumaEvent && !isRoutineResidentsDay && (
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: badgeGradient }} aria-hidden />
      )}
      {/* Badges row — comfortable padding so text isn’t cramped */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-semibold",
            isRoutineResidentsDay
              ? "bg-stone-200/80 text-stone-700 border border-stone-300/60"
              : cn(!badge.gradient && badge.bg, badge.text),
          )}
          style={!isRoutineResidentsDay && badge.gradient ? { background: badgeGradient } : undefined}
        >
          {isRoutineResidentsDay ? "Resident day" : typeLabel(event.type)}
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
      <h3
        className={cn(
          "text-base sm:text-lg font-semibold leading-snug mb-3",
          isRoutineResidentsDay ? "text-stone-700 font-medium" : "text-gray-900",
        )}
      >
        {event.title}
      </h3>

      {/* Date & location */}
      <div
        className={cn(
          "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5 text-sm mb-4",
          isRoutineResidentsDay ? "text-stone-500" : "text-gray-500",
        )}
      >
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

      {/* Description: truncate with max-height when collapsed so Read more / Show less works (line-clamp fails with inner <p>). */}
      {event.description && (
        <div className="mb-4">
          {isRoutineResidentsDay ? (
            <p className="text-sm text-stone-600 leading-relaxed">{event.description}</p>
          ) : (
            <>
              <div
                ref={descriptionRef}
                className="text-sm text-gray-600 leading-relaxed event-card-description"
                style={
                  !expanded
                    ? { maxHeight: "4.5rem", overflow: "hidden" }
                    : undefined
                }
                dangerouslySetInnerHTML={{ __html: formatEventDescriptionToHtml(event.description) }}
              />
              {showReadMore && (
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
          )}
        </div>
      )}

      {/* RSVP section: show when user is signed in or anyone has gone or is interested */}
      {showRsvpSection && (
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
          {/* Always show going and interested separately so the difference is obvious */}
          {(rsvpSummary.going > 0 || rsvpSummary.interested > 0) && (
            <p className="text-xs text-gray-600" role="status">
              {rsvpSummary.going > 0 && (
                <span className="font-medium text-emerald-700">{rsvpSummary.going} going</span>
              )}
              {rsvpSummary.going > 0 && rsvpSummary.interested > 0 && (
                <span className="text-gray-400 mx-1">·</span>
              )}
              {rsvpSummary.interested > 0 && (
                <span className="font-medium text-amber-700">{rsvpSummary.interested} interested</span>
              )}
            </p>
          )}
          {goingPeople.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-emerald-700">Going:</span>
              <AttendanceAvatars people={goingPeople} label="going" onPersonClick={onPersonClick} />
            </div>
          )}
          {interestedPeople.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-amber-700">Interested:</span>
              <AttendanceAvatars people={interestedPeople} label="interested" onPersonClick={onPersonClick} />
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
