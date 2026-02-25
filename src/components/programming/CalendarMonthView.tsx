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

import { useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { NodeEvent, EventType } from "../../types/events";
import { cn } from "../ui/utils";

/* ─── constants ─────────────────────────────────────────────── */

const DAY_LABELS_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABELS_NARROW = ["S", "M", "T", "W", "T", "F", "S"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TYPE_DOT_COLOR: Record<EventType | string, string> = {
  coworking:    "bg-sky-500",
  workshop:     "bg-amber-500",
  conference:   "bg-indigo-500",
  launch:       "bg-teal-500",
  "open-house": "bg-violet-500",
  demo:         "bg-orange-500",
  social:       "bg-pink-500",
  flagship:     "bg-rose-500",
  other:        "bg-gray-400",
};

const TYPE_CHIP_STYLE: Record<EventType | string, { bg: string; text: string; border: string }> = {
  coworking:    { bg: "bg-sky-50",    text: "text-sky-700",    border: "border-sky-200" },
  workshop:     { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
  conference:   { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  launch:       { bg: "bg-teal-50",   text: "text-teal-700",   border: "border-teal-200" },
  "open-house": { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  demo:         { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  social:       { bg: "bg-pink-50",   text: "text-pink-700",   border: "border-pink-200" },
  flagship:     { bg: "bg-rose-50",   text: "text-rose-700",   border: "border-rose-200" },
  other:        { bg: "bg-gray-50",   text: "text-gray-600",   border: "border-gray-200" },
};

/** Maximum event chips shown per day cell before "+N more". */
const MAX_DESKTOP_CHIPS = 3;

/* ─── helpers ───────────────────────────────────────────────── */

function dotColor(type: string) {
  return TYPE_DOT_COLOR[type] ?? TYPE_DOT_COLOR.other;
}

function chipStyle(type: string) {
  return TYPE_CHIP_STYLE[type] ?? TYPE_CHIP_STYLE.other;
}

function formatChipTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
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

/** A single event chip inside a desktop day cell. */
function EventChip({ event }: { event: NodeEvent }) {
  const style = chipStyle(event.type);
  const time = formatChipTime(event.startAt);
  const href = event.externalLink;

  const inner = (
    <span
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] leading-tight font-medium border truncate",
        "transition-colors cursor-default",
        style.bg, style.text, style.border,
        href && "hover:brightness-95 cursor-pointer",
      )}
      title={`${time} — ${event.title}`}
    >
      <span className={cn("size-1.5 rounded-full flex-shrink-0", dotColor(event.type))} />
      <span className="truncate">
        <span className="font-semibold">{time}</span>{" "}
        {event.title}
      </span>
    </span>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    );
  }
  return inner;
}

/** Mobile detail card for a single event on the selected day. */
function MobileEventRow({ event }: { event: NodeEvent }) {
  const style = chipStyle(event.type);
  const time = formatChipTime(event.startAt);
  const href = event.externalLink;

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl border transition-colors",
        style.bg, style.border,
        href && "hover:brightness-[0.97] cursor-pointer",
      )}
    >
      <span className={cn("mt-1.5 size-2 rounded-full flex-shrink-0", dotColor(event.type))} />
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
  onEventClick?: (eventId: string) => void;
}

export function CalendarMonthView({ events, year, initialMonth, onEventClick }: CalendarMonthViewProps) {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => {
    if (initialMonth !== null && initialMonth !== undefined) return initialMonth;
    return today.getFullYear() === year ? today.getMonth() : 0;
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

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

  const prevMonth = () => setMonth((m) => (m > 0 ? m - 1 : 11));
  const nextMonth = () => setMonth((m) => (m < 11 ? m + 1 : 0));

  const selectedDayEvents = selectedDay ? (dayMap.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-4">
      {/* ── Month header with navigation ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-[10rem] text-center">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 tabular-nums">
              {MONTH_NAMES[month]} {year}
            </h3>
            {monthEvents.length > 0 && (
              <p className="text-[11px] text-gray-400 tabular-nums">
                {monthEvents.length} event{monthEvents.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <button
          onClick={goToday}
          className="text-xs font-medium px-3 py-1.5 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors"
        >
          Today
        </button>
      </div>

      {/* ── Desktop grid (hidden on mobile) ── */}
      <div className="hidden md:block">
        <DesktopGrid
          cells={cells}
          dayMap={dayMap}
          month={month}
          year={year}
          isToday={isToday}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onEventClick={onEventClick}
        />
      </div>

      {/* ── Mobile mini-calendar + detail (hidden on desktop) ── */}
      <div className="md:hidden">
        <MiniCalendar
          cells={cells}
          dayMap={dayMap}
          isToday={isToday}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
        {selectedDay !== null && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
              {MONTH_NAMES[month]} {selectedDay}
            </p>
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-gray-400 px-1">No events this day</p>
            ) : (
              selectedDayEvents
                .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
                .map((ev) => <MobileEventRow key={ev.id} event={ev} />)
            )}
          </div>
        )}
      </div>

      {/* ── Desktop selected-day detail strip ── */}
      {selectedDay !== null && (
        <div className="hidden md:block">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="size-4 text-teal-600" />
            <span className="text-sm font-semibold text-gray-900">
              {MONTH_NAMES[month]} {selectedDay}
            </span>
            <span className="text-xs text-gray-400">
              {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? "s" : ""}
            </span>
          </div>
          {selectedDayEvents.length === 0 ? (
            <p className="text-sm text-gray-400">No events this day.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {selectedDayEvents
                .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
                .map((ev) => <MobileEventRow key={ev.id} event={ev} />)}
            </div>
          )}
        </div>
      )}
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
  onEventClick?: (eventId: string) => void;
}

function DesktopGrid({
  cells,
  dayMap,
  isToday,
  selectedDay,
  onSelectDay,
  onEventClick,
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
                  <div key={ev.id} onClick={(e) => { e.stopPropagation(); onEventClick?.(ev.id); }}>
                    <EventChip event={ev} />
                  </div>
                ))}
                {overflow > 0 && (
                  <span className="block text-[10px] text-gray-400 font-medium pl-1.5">
                    +{overflow} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Mobile mini-calendar ──────────────────────────────────── */

interface MiniCalendarProps {
  cells: (number | null)[];
  dayMap: Map<number, NodeEvent[]>;
  isToday: (day: number) => boolean;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
}

function MiniCalendar({ cells, dayMap, isToday, selectedDay, onSelectDay }: MiniCalendarProps) {
  return (
    <div>
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS_NARROW.map((d, i) => (
          <div key={`${d}-${i}`} className="text-center text-[10px] font-semibold text-gray-400 uppercase py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} className="aspect-square" />;

          const dayEvents = dayMap.get(day) ?? [];
          const todayCell = isToday(day);
          const selected = selectedDay === day;
          const hasEvents = dayEvents.length > 0;

          return (
            <button
              key={day}
              onClick={() => onSelectDay(selected ? null : day)}
              className={cn(
                "aspect-square flex flex-col items-center justify-center rounded-lg transition-colors relative",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
                selected
                  ? "bg-teal-100 ring-1 ring-teal-300"
                  : todayCell
                    ? "bg-teal-50"
                    : "hover:bg-gray-100",
              )}
            >
              <span
                className={cn(
                  "text-xs font-semibold",
                  todayCell && !selected
                    ? "text-teal-700"
                    : selected
                      ? "text-teal-800"
                      : "text-gray-700",
                )}
              >
                {day}
              </span>

              {/* Dot indicators — up to 3 colored dots per event type present */}
              {hasEvents && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {uniqueTypes(dayEvents).slice(0, 3).map((t, i) => (
                    <span key={i} className={cn("size-1 rounded-full", dotColor(t))} />
                  ))}
                </div>
              )}
            </button>
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
