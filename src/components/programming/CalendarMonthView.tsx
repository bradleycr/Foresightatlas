/**
 * CalendarMonthView — full month grid for the programming pages.
 *
 * Desktop (md+): traditional 7-column Sun–Sat grid with event chips.
 * Mobile: compact mini-calendar with dot indicators, plus an
 * expandable day-detail list beneath — because a full grid is
 * illegible on narrow screens.
 *
 * Color language matches the rest of the app: teal accents for
 * "today" and selection, event-type dots pulled from the same
 * palette as EventCard badges.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, MapPin, Clock, ExternalLink, Ticket, CalendarPlus } from "lucide-react";
import { NodeEvent, EventType } from "../../types/events";
import { BERLIN_RESIDENTS_DAY_RECURRENCE_GROUP_ID } from "../../data/events";
import { cn } from "../ui/utils";
import { useIsMobile } from "../ui/use-mobile";
import { isLumaUrl, normalizeExternalUrl } from "../../utils/externalUrl";

/* ─── constants ─────────────────────────────────────────────── */

const DAY_LABELS_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TYPE_DOT_COLOR: Record<EventType | string, string> = {
  coworking:    "bg-sky-500",
  workshop:     "bg-amber-500",
  conference:   "bg-indigo-500",
  launch:       "bg-indigo-500",
  "open-house": "bg-indigo-500",
  demo:         "bg-orange-500",
  social:       "bg-pink-500",
  flagship:     "bg-rose-500",
  "vision-weekend": "bg-violet-500",
  other:        "bg-gray-400",
};

const TYPE_CHIP_STYLE: Record<EventType | string, { bg: string; text: string; border: string }> = {
  coworking:    { bg: "bg-sky-50",    text: "text-sky-700",    border: "border-sky-200" },
  workshop:     { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
  conference:   { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  launch:       { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  "open-house": { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  demo:         { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  social:       { bg: "bg-pink-50",   text: "text-pink-700",   border: "border-pink-200" },
  flagship:     { bg: "bg-rose-50",   text: "text-rose-700",   border: "border-rose-200" },
  "vision-weekend": { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  other:        { bg: "bg-gray-50",   text: "text-gray-600",   border: "border-gray-200" },
};

/** Muted chip/dot for injected weekly Berlin resident days (vs Luma “real” events). */
const ROUTINE_RESIDENTS_CHIP = {
  bg: "bg-stone-100/90",
  text: "text-stone-600",
  border: "border-stone-200/80",
} as const;
const ROUTINE_RESIDENTS_DOT = "bg-stone-400";

/** Maximum event chips shown per day cell before "+N more". */
const MAX_DESKTOP_CHIPS = 3;

/* ─── helpers ───────────────────────────────────────────────── */

function isRoutineBerlinResidentsDay(ev: NodeEvent): boolean {
  return ev.recurrenceGroupId === BERLIN_RESIDENTS_DAY_RECURRENCE_GROUP_ID;
}

function dotColor(type: string) {
  return TYPE_DOT_COLOR[type] ?? TYPE_DOT_COLOR.other;
}

function dotColorForEvent(ev: NodeEvent): string {
  return isRoutineBerlinResidentsDay(ev) ? ROUTINE_RESIDENTS_DOT : dotColor(ev.type);
}

function chipStyle(type: string) {
  return TYPE_CHIP_STYLE[type] ?? TYPE_CHIP_STYLE.other;
}

function chipStyleForEvent(ev: NodeEvent) {
  return isRoutineBerlinResidentsDay(ev) ? ROUTINE_RESIDENTS_CHIP : chipStyle(ev.type);
}

function formatChipTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

function formatTimeRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const fmt: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${s.toLocaleTimeString("en-US", fmt)} - ${e.toLocaleTimeString("en-US", fmt)}`.toLowerCase();
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/** Build a Date → event[] lookup for every day in the month. */
function buildDayMap(events: NodeEvent[], year: number, month: number) {
  const map = new Map<number, NodeEvent[]>();
  for (const ev of events) {
    const start = new Date(ev.startAt);
    const end = new Date(ev.endAt);
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const loopStart = start < monthStart ? monthStart : start;
    const loopEnd = end > monthEnd ? monthEnd : end;
    for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() !== month) continue;
      const day = d.getDate();
      const list = map.get(day) ?? [];
      if (!list.some((e) => e.id === ev.id)) list.push(ev);
      map.set(day, list);
    }
  }
  return map;
}

/** All calendar cells for a month — leading empties from prev month, then 1..N. */
function calendarGrid(year: number, month: number) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/* ─── sub-components ────────────────────────────────────────── */

/** A single event chip inside a desktop day cell — always clickable (opens popover). */
function EventChip({ event }: { event: NodeEvent }) {
  const style = chipStyleForEvent(event);
  const time = formatChipTime(event.startAt);

  return (
    <span
      className={cn(
        "flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] leading-tight font-medium border truncate",
        "transition-colors cursor-pointer hover:brightness-95",
        style.bg, style.text, style.border,
      )}
      title={`${time} — ${event.title}`}
    >
      <span className={cn("size-1.5 rounded-full flex-shrink-0", dotColorForEvent(event))} />
      <span className="truncate">
        <span className="font-semibold">{time}</span>{" "}
        {event.title}
      </span>
    </span>
  );
}

/** Compact popover that floats over the calendar when clicking an event chip. */
function EventPopover({
  event,
  anchorRect,
  onClose,
}: {
  event: NodeEvent;
  anchorRect: DOMRect | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const style = chipStyleForEvent(event);
  const timeRange = formatTimeRange(event.startAt, event.endAt);
  const externalLink = normalizeExternalUrl(event.externalLink);
  const luma = isLumaUrl(externalLink);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const posStyle = anchorRect
    ? { top: anchorRect.bottom + 6, left: Math.max(8, anchorRect.left), maxWidth: "min(18rem, calc(100vw - 1rem))" }
    : {};

  return (
    <div ref={ref} className="fixed z-[100]" style={posStyle}>
      <div className="bg-white rounded-xl shadow-lg ring-1 ring-gray-200 overflow-hidden">
        <div className={cn("h-1", dotColorForEvent(event))} />

        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn("text-sm font-bold leading-snug", style.text)}>
              {event.title}
            </h4>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-0.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 text-xs text-gray-500">
            <p className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-gray-400 flex-shrink-0" />
              {timeRange}
            </p>
            <p className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-gray-400 flex-shrink-0" />
              {event.location}
            </p>
          </div>

          {externalLink && (
            <a
              href={externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
            >
              {luma ? <Ticket className="size-3.5" /> : <ExternalLink className="size-3.5" />}
              {luma ? "View on Luma" : "More info"}
            </a>
          )}

          <a
            href={googleCalUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            <CalendarPlus className="size-3.5" />
            Add to My Calendar
          </a>
        </div>
      </div>
    </div>
  );
}

/** Build a Google Calendar "add event" URL. */
function googleCalUrl(ev: NodeEvent): string {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const externalLink = normalizeExternalUrl(ev.externalLink);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${fmt(ev.startAt)}/${fmt(ev.endAt)}`,
    location: ev.location,
    details: externalLink ? `${ev.description}\n\n${externalLink}` : ev.description,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Mobile detail card for a single event on the selected day. */
function MobileEventRow({ event }: { event: NodeEvent }) {
  const style = chipStyleForEvent(event);
  const time = formatChipTime(event.startAt);
  const href = normalizeExternalUrl(event.externalLink);

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl border transition-colors",
        style.bg, style.border,
        href && "hover:brightness-[0.97] cursor-pointer",
      )}
    >
      <span className={cn("mt-1.5 size-2 rounded-full flex-shrink-0", dotColorForEvent(event))} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold leading-snug", style.text)}>
          {event.title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {time} · {event.location}
        </p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }
  return content;
}

/* ─── main component ────────────────────────────────────────── */

interface CalendarMonthViewProps {
  events: NodeEvent[];
  year: number;
  /** When set, calendar opens to this month (0-indexed). */
  initialMonth?: number | null;
}

export function CalendarMonthView({ events, year, initialMonth }: CalendarMonthViewProps) {
  const today = useMemo(() => new Date(), []);
  const isMobile = useIsMobile();
  const [month, setMonth] = useState(() => {
    if (initialMonth !== null && initialMonth !== undefined) return initialMonth;
    return today.getFullYear() === year ? today.getMonth() : 0;
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [popover, setPopover] = useState<{ event: NodeEvent; rect: DOMRect } | null>(null);

  const monthEvents = useMemo(
    () => events.filter((e) => {
      const d = new Date(e.startAt);
      const endD = new Date(e.endAt);
      return (
        (d.getFullYear() === year && d.getMonth() === month) ||
        (endD.getFullYear() === year && endD.getMonth() === month)
      );
    }),
    [events, year, month],
  );

  const dayMap = useMemo(() => buildDayMap(monthEvents, year, month), [monthEvents, year, month]);
  const cells = useMemo(() => calendarGrid(year, month), [year, month]);

  const isToday = useCallback(
    (day: number) => isSameDay(new Date(year, month, day), today),
    [year, month, today],
  );

  const goToday = useCallback(() => {
    if (today.getFullYear() === year) {
      setMonth(today.getMonth());
      setSelectedDay(today.getDate());
    }
  }, [today, year]);

  const prevMonth = () => { setMonth((m) => (m > 0 ? m - 1 : 11)); setPopover(null); };
  const nextMonth = () => { setMonth((m) => (m < 11 ? m + 1 : 0)); setPopover(null); };

  const handleChipClick = useCallback((event: NodeEvent, rect: DOMRect) => {
    setPopover((prev) => prev?.event.id === event.id ? null : { event, rect });
  }, []);

  const selectedDayEvents = selectedDay ? (dayMap.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-4">
      {/* ── Month header with navigation ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={prevMonth}
            className="p-2 sm:p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors touch-manipulation"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 text-center">
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 tabular-nums truncate">
              {MONTH_NAMES[month]} {year}
            </h3>
            {monthEvents.length > 0 && (
              <p className="text-[10px] sm:text-[11px] text-gray-400 tabular-nums">
                {monthEvents.length} event{monthEvents.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button
            onClick={nextMonth}
            className="p-2 sm:p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors touch-manipulation"
            aria-label="Next month"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <button
          onClick={goToday}
          className="text-xs font-medium px-3 py-2.5 sm:py-2 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors touch-manipulation shrink-0"
        >
          Today
        </button>
      </div>

      {/* ── Desktop grid (hidden on mobile via JS so layout is reliable on all screens) ── */}
      {!isMobile && (
        <div>
          <DesktopGrid
            cells={cells}
            dayMap={dayMap}
            month={month}
            year={year}
            isToday={isToday}
            selectedDay={selectedDay}
            onSelectDay={(d) => { setSelectedDay(d); setPopover(null); }}
            onChipClick={handleChipClick}
          />
        </div>
      )}

      {/* ── Mobile: agenda list by day (no grid — thumb-friendly) ── */}
      {isMobile && (
        <MobileMonthAgenda
          month={month}
          year={year}
          dayMap={dayMap}
          formatDayLabel={(day) => {
            const d = new Date(year, month, day);
            return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
          }}
        />
      )}

      {/* Desktop: day-click shows a summary row beneath the grid for multi-event days */}
      {!isMobile && selectedDay !== null && selectedDayEvents.length > 1 && (
        <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
          <span className="font-semibold text-gray-700">{MONTH_NAMES[month]} {selectedDay}</span>
          <span>{selectedDayEvents.length} events — click any event above for details</span>
        </div>
      )}

      {/* Fixed-position event popover — rendered outside the grid to escape overflow-hidden */}
      {popover && (
        <EventPopover
          event={popover.event}
          anchorRect={popover.rect}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}

/* ─── Mobile month agenda (replaces grid on small screens) ───── */

interface MobileMonthAgendaProps {
  month: number;
  year: number;
  dayMap: Map<number, NodeEvent[]>;
  formatDayLabel: (day: number) => string;
}

function MobileMonthAgenda({ month, year, dayMap, formatDayLabel }: MobileMonthAgendaProps) {
  const daysWithEvents = useMemo(
    () => Array.from(dayMap.keys()).sort((a, b) => a - b),
    [dayMap],
  );

  if (daysWithEvents.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-500">No events in {MONTH_NAMES[month]}</p>
        <p className="text-xs text-gray-400 mt-1">Use the arrows above to pick another month</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {daysWithEvents.map((day) => {
        const events = (dayMap.get(day) ?? [])
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
        return (
          <section key={day} className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 bg-white py-1 -mx-1 px-1">
              {formatDayLabel(day)}
            </h4>
            <div className="space-y-2">
              {events.map((ev) => (
                <MobileEventRow key={ev.id} event={ev} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ─── Desktop 7-column grid ─────────────────────────────────── */

interface DesktopGridProps {
  cells: (number | null)[];
  dayMap: Map<number, NodeEvent[]>;
  month: number;
  year: number;
  isToday: (day: number) => boolean;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
  onChipClick: (event: NodeEvent, anchorRect: DOMRect) => void;
}

function DesktopGrid({
  cells,
  dayMap,
  isToday,
  selectedDay,
  onSelectDay,
  onChipClick,
}: DesktopGridProps) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {DAY_LABELS_FULL.map((d) => (
          <div
            key={d}
            className="py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`e-${idx}`} className="min-h-[6.5rem] bg-gray-50/40 border-b border-r border-gray-100" />;
          }

          const dayEvents = dayMap.get(day) ?? [];
          const todayCell = isToday(day);
          const selected = selectedDay === day;
          const sorted = dayEvents.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
          const visible = sorted.slice(0, MAX_DESKTOP_CHIPS);
          const overflow = sorted.length - MAX_DESKTOP_CHIPS;

          return (
            <div
              key={day}
              role="gridcell"
              tabIndex={0}
              onClick={() => onSelectDay(selected ? null : day)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectDay(selected ? null : day); } }}
              className={cn(
                "min-h-[6.5rem] p-1.5 text-left border-b border-r border-gray-100 transition-colors cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500",
                selected
                  ? "bg-teal-50/60"
                  : dayEvents.length > 0
                    ? "bg-white hover:bg-gray-50/70"
                    : "bg-white hover:bg-gray-50/40",
              )}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center size-6 rounded-full text-xs font-semibold mb-1",
                  todayCell
                    ? "bg-teal-600 text-white"
                    : selected
                      ? "bg-teal-100 text-teal-700"
                      : "text-gray-700",
                )}
              >
                {day}
              </span>

              <div className="space-y-0.5">
                {visible.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChipClick(ev, (e.currentTarget as HTMLElement).getBoundingClientRect());
                    }}
                  >
                    <EventChip event={ev} />
                  </div>
                ))}
                {overflow > 0 && (
                  <button
                    className="block text-[10px] text-gray-400 hover:text-gray-600 font-medium pl-1.5 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onSelectDay(day); }}
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Unique event types present in a list of events, stable order. */
function uniqueTypes(events: NodeEvent[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const e of events) {
    if (!seen.has(e.type)) {
      seen.add(e.type);
      result.push(e.type);
    }
  }
  return result;
}
