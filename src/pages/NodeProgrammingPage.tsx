/**
 * Node Programming Page — the events hub for each Foresight node.
 *
 * Redesigned with a branded hero, spacious calendar grid, elegant
 * identity flow, and polished event cards. Optimised for both
 * quick-glance browsing and deep RSVP interaction.
 */

import { useState, useMemo, useCallback } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { NodeSlug, RSVPStatus } from "../types/events";
import { Person } from "../types";
import { getNode } from "../data/nodes";
import { getEventsByNode } from "../data/events";
import {
  getIdentity,
  setIdentity as persistIdentity,
  clearIdentity,
} from "../services/identity";
import {
  setRSVP,
  removeRSVP,
  getRSVP,
  getEventRSVPSummary,
} from "../services/rsvp";
import { NodeSwitch } from "../components/programming/NodeSwitch";
import { IdentityBanner } from "../components/programming/IdentityBanner";
import { MonthNavigator } from "../components/programming/MonthNavigator";
import { EventCard } from "../components/programming/EventCard";

const YEAR = 2026;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const NODE_HERO_GRADIENT: Record<NodeSlug, string> = {
  berlin: "linear-gradient(135deg, #2563eb, #4f46e5)",
  sf: "linear-gradient(135deg, #f59e0b, #ea580c)",
};

interface NodeProgrammingPageProps {
  initialNode: NodeSlug;
  people: Person[];
  onNavigateHome: () => void;
  onNavigateNode: (slug: NodeSlug) => void;
  onShowEventOnMap?: (eventId: string, goingPersonIds: string[]) => void;
}

export function NodeProgrammingPage({
  initialNode,
  people,
  onNavigateHome,
  onNavigateNode,
  onShowEventOnMap,
}: NodeProgrammingPageProps) {
  const [activeNode, setActiveNode] = useState<NodeSlug>(initialNode);
  const [identity, setIdentityState] = useState(() => getIdentity());
  const [rsvpTick, setRsvpTick] = useState(0);

  const [selectedMonth, setSelectedMonth] = useState<number | null>(() => {
    const now = new Date();
    return now.getFullYear() === YEAR ? now.getMonth() : 0;
  });

  const node = getNode(activeNode)!;
  const allEvents = useMemo(() => getEventsByNode(activeNode), [activeNode]);
  const isAuthed = identity !== null;

  /* ── counts per month ─────────────────────────────────────────── */
  const monthlyCounts = useMemo(() => {
    const c = new Array(12).fill(0) as number[];
    for (const ev of allEvents) {
      const m = new Date(ev.startAt);
      if (m.getFullYear() === YEAR) c[m.getMonth()]++;
    }
    return c;
  }, [allEvents]);

  /* ── filtered events ──────────────────────────────────────────── */
  const filteredEvents = useMemo(() => {
    if (selectedMonth === null) {
      const now = Date.now();
      const cut = now + 90 * 24 * 60 * 60 * 1000;
      return allEvents.filter((e) => {
        const t = new Date(e.startAt).getTime();
        return t >= now && t <= cut;
      });
    }
    return allEvents.filter((e) => {
      const d = new Date(e.startAt);
      return d.getFullYear() === YEAR && d.getMonth() === selectedMonth;
    });
  }, [allEvents, selectedMonth]);

  /* ── identity handlers ────────────────────────────────────────── */
  const handleIdentitySelect = useCallback((personId: string, fullName: string) => {
    persistIdentity(personId, fullName);
    setIdentityState({ personId, fullName, selectedAt: new Date().toISOString() });
  }, []);

  const handleIdentityClear = useCallback(() => {
    clearIdentity();
    setIdentityState(null);
  }, []);

  /* ── RSVP handlers ────────────────────────────────────────────── */
  const handleRSVPChange = useCallback(
    (eventId: string, status: RSVPStatus | null) => {
      if (!identity) return;
      if (status === null) removeRSVP(eventId, identity.personId);
      else setRSVP(eventId, identity.personId, status);
      setRsvpTick((t) => t + 1);
    },
    [identity],
  );

  const summaryOf = useCallback(
    (eventId: string) => { void rsvpTick; return getEventRSVPSummary(eventId); },
    [rsvpTick],
  );

  const userStatusOf = useCallback(
    (eventId: string): RSVPStatus | null => {
      void rsvpTick;
      if (!identity) return null;
      return getRSVP(eventId, identity.personId)?.status ?? null;
    },
    [identity, rsvpTick],
  );

  /* ── node switch ──────────────────────────────────────────────── */
  const handleNodeChange = useCallback(
    (slug: NodeSlug) => {
      setActiveNode(slug);
      onNavigateNode(slug);
    },
    [onNavigateNode],
  );

  /* ── section label ────────────────────────────────────────────── */
  const sectionLabel = selectedMonth === null
    ? "Upcoming Events"
    : `${MONTH_NAMES[selectedMonth]} Events`;

  const emptyState = filteredEvents.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* ── Hero section ──────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: NODE_HERO_GRADIENT[activeNode] }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8 sm:pt-6 sm:pb-10 relative">
          {/* Nav row */}
          <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8">
            <button
              onClick={onNavigateHome}
              className="inline-flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Back to map</span>
            </button>
            <NodeSwitch activeNode={activeNode} onChange={handleNodeChange} />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-heading">
              {node.city} Programming
            </h1>
            <p className="text-sm sm:text-base text-white/70 max-w-xl leading-relaxed">
              {node.description}
            </p>
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">

        {/* Calendar card */}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-4 sm:p-5 mb-6">
          <MonthNavigator
            selected={selectedMonth}
            year={YEAR}
            counts={monthlyCounts}
            onChange={setSelectedMonth}
          />
        </div>

        {/* Identity strip */}
        <div className="mb-6">
          <IdentityBanner
            identity={identity}
            people={people}
            onSelect={handleIdentitySelect}
            onClear={handleIdentityClear}
          />
        </div>

        {/* Section header */}
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">{sectionLabel}</h2>
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-sm text-gray-400 tabular-nums">
            {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Event list */}
        {emptyState ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
            <Sparkles className="size-10 text-gray-200 mx-auto mb-4" />
            <p className="text-base font-medium text-gray-500">
              {selectedMonth === null
                ? "No upcoming events in the next 90 days"
                : `No events scheduled for ${MONTH_NAMES[selectedMonth]}`}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Try a different month or{" "}
              <button
                onClick={() => setSelectedMonth(null)}
                className="text-teal-600 hover:text-teal-700 font-medium hover:underline"
              >
                view all upcoming
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredEvents.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                rsvpSummary={summaryOf(ev.id)}
                currentUserStatus={userStatusOf(ev.id)}
                onRSVPChange={handleRSVPChange}
                onShowOnMap={onShowEventOnMap ? (id) => {
                  onShowEventOnMap(id, getEventRSVPSummary(id).goingPersonIds);
                } : undefined}
                allPeople={people}
                isAuthenticated={isAuthed}
              />
            ))}
          </div>
        )}

        <div className="h-20" aria-hidden />
      </div>
    </div>
  );
}
