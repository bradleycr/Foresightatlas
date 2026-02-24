/**
 * The main timeline feed — groups events into "This Week", then monthly
 * sections. Supports time/type filtering and recurring-event collapsing.
 */

import { useMemo, useState } from "react";
import { Calendar, Filter } from "lucide-react";
import { NodeEvent, RSVPStatus, RSVPSummary } from "../../types/events";
import { Person } from "../../types";
import { EventCard } from "./EventCard";
import { cn } from "../ui/utils";

/* ── types ──────────────────────────────────────────────────────────── */

type TimeFilter = "upcoming" | "all" | "my-rsvps";

interface EventGroup {
  id: string;
  label: string;
  sublabel?: string;
  events: NodeEvent[];
}

interface ProgrammingTimelineProps {
  events: NodeEvent[];
  allPeople: Person[];
  getRSVPSummary: (eventId: string) => RSVPSummary;
  getCurrentUserStatus: (eventId: string) => RSVPStatus | null;
  onRSVPChange: (eventId: string, status: RSVPStatus | null) => void;
  onShowOnMap?: (eventId: string) => void;
  isAuthenticated: boolean;
  scrollToMonth?: number | null;
}

/* ── constants ──────────────────────────────────────────────────────── */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/* ── helpers ────────────────────────────────────────────────────────── */

function groupByMonth(events: NodeEvent[]): EventGroup[] {
  const map = new Map<string, NodeEvent[]>();

  for (const ev of events) {
    const d = new Date(ev.startAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, evts]) => {
      const [yr, mo] = key.split("-").map(Number);
      return { id: key, label: MONTH_NAMES[mo], sublabel: String(yr), events: evts };
    });
}

/** Keep only the next upcoming occurrence per recurrence group. */
function collapseRecurring(events: NodeEvent[]): NodeEvent[] {
  const now = Date.now();
  const groups = new Map<string, NodeEvent[]>();
  const singles: NodeEvent[] = [];

  for (const ev of events) {
    if (ev.recurrenceGroupId) {
      if (!groups.has(ev.recurrenceGroupId))
        groups.set(ev.recurrenceGroupId, []);
      groups.get(ev.recurrenceGroupId)!.push(ev);
    } else {
      singles.push(ev);
    }
  }

  const result = [...singles];

  for (const grp of groups.values()) {
    const future = grp
      .filter((e) => new Date(e.startAt).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
    result.push(future[0] ?? grp[grp.length - 1]);
  }

  return result.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
}

/* ── component ──────────────────────────────────────────────────────── */

export function ProgrammingTimeline({
  events,
  allPeople,
  getRSVPSummary,
  getCurrentUserStatus,
  onRSVPChange,
  onShowOnMap,
  isAuthenticated,
}: ProgrammingTimelineProps) {
  const [filter, setFilter] = useState<TimeFilter>("upcoming");
  const [typeFilter, setTypeFilter] = useState("all");
  const [collapsed, setCollapsed] = useState(true);

  const now = useMemo(() => new Date(), []);

  const eventTypes = useMemo(() => {
    const set = new Set(events.map((e) => e.type));
    return ["all", ...Array.from(set).sort()];
  }, [events]);

  /* ── apply filters ───────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    let list = events;

    if (typeFilter !== "all") list = list.filter((e) => e.type === typeFilter);

    if (filter === "upcoming") {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() + 90);
      list = list.filter(
        (e) => new Date(e.startAt) >= now && new Date(e.startAt) <= cutoff,
      );
    } else if (filter === "my-rsvps") {
      list = list.filter((e) => getCurrentUserStatus(e.id) !== null);
    }

    return list;
  }, [events, filter, typeFilter, now, getCurrentUserStatus]);

  /* ── "this week" slice ───────────────────────────────────────────── */

  const thisWeek = useMemo(() => {
    const ws = new Date(now);
    ws.setDate(ws.getDate() - ws.getDay());
    ws.setHours(0, 0, 0, 0);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    return filtered.filter((e) => {
      const s = new Date(e.startAt);
      return s >= ws && s < we;
    });
  }, [filtered, now]);

  const weekIds = useMemo(() => new Set(thisWeek.map((e) => e.id)), [thisWeek]);

  /* ── remaining events grouped by month ───────────────────────────── */

  const monthGroups = useMemo(() => {
    const rest = filtered.filter((e) => !weekIds.has(e.id));
    return groupByMonth(collapsed ? collapseRecurring(rest) : rest);
  }, [filtered, weekIds, collapsed]);

  const hasRecurring = events.some((e) => e.recurrenceGroupId);

  /* ── render ──────────────────────────────────────────────────────── */

  return (
    <div className="space-y-10">
      {/* ── filter bar ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-4 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div
            className="inline-flex rounded-xl bg-white border border-gray-200 p-1 shadow-sm"
            role="tablist"
          >
            {(
              [
                { key: "upcoming", label: "Upcoming" },
                { key: "all", label: "All Events" },
                ...(isAuthenticated
                  ? [{ key: "my-rsvps", label: "My RSVPs" }]
                  : []),
              ] as { key: TimeFilter; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  filter === key
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Filter className="size-4 text-gray-400 flex-shrink-0" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            >
              {eventTypes.map((t) => (
                <option key={t} value={t}>
                  {t === "all"
                    ? "All types"
                    : t
                        .replace(/-/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {hasRecurring && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                "text-sm font-medium px-4 py-2 rounded-lg border transition-all",
                collapsed
                  ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
              )}
            >
              {collapsed ? "Recurring: next only" : "Recurring: show all"}
            </button>
          )}
        </div>
      </div>

      {/* ── this week ───────────────────────────────────────────── */}
      {thisWeek.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-700">
              This Week
            </h3>
            <span className="text-sm text-gray-500">
              {thisWeek.length} event{thisWeek.length !== 1 && "s"}
            </span>
          </div>
          <div className="space-y-5">
            {thisWeek.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                rsvpSummary={getRSVPSummary(ev.id)}
                currentUserStatus={getCurrentUserStatus(ev.id)}
                onRSVPChange={onRSVPChange}
                onShowOnMap={onShowOnMap}
                allPeople={allPeople}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── monthly groups ──────────────────────────────────────── */}
      {monthGroups.map((g) => (
        <section key={g.id} id={`month-${g.id}`} className="scroll-mt-6">
          <div className="flex items-center gap-3 mb-5">
            <Calendar className="size-5 text-gray-400 flex-shrink-0" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600">
              {g.label}
            </h3>
            <span className="text-sm text-gray-500">{g.sublabel}</span>
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-500">
              {g.events.length} event{g.events.length !== 1 && "s"}
            </span>
          </div>
          <div className="space-y-5">
            {g.events.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                rsvpSummary={getRSVPSummary(ev.id)}
                currentUserStatus={getCurrentUserStatus(ev.id)}
                onRSVPChange={onRSVPChange}
                onShowOnMap={onShowOnMap}
                allPeople={allPeople}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>
        </section>
      ))}

      {/* ── empty state ─────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 p-8 text-center">
          <Calendar className="size-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            No events match your filters
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {filter === "my-rsvps"
              ? "You haven't RSVP'd to any events yet."
              : "Try adjusting the time range or type filter."}
          </p>
        </div>
      )}
    </div>
  );
}
