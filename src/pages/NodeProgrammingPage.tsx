/**
 * Node Programming Page
 *
 * Visual language deliberately matches the main Fellows Map app:
 * white cards, subtle borders, teal CTA accents, same typography.
 *
 * Primary UX: the MonthNavigator strip is the main filter control.
 * Clicking a month shows all events in that month cleanly.
 * "Show all upcoming" resets to the next-30-days default.
 */

import { useState, useMemo, useCallback } from "react";
import { ArrowLeft, Calendar } from "lucide-react";
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
import { Button } from "../components/ui/button";

const YEAR = 2026;

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

  /* null = upcoming/all; 0–11 = specific month */
  const [selectedMonth, setSelectedMonth] = useState<number | null>(() => {
    const now = new Date();
    return now.getFullYear() === YEAR ? now.getMonth() : 0;
  });

  const node = getNode(activeNode)!;
  const allEvents = useMemo(() => getEventsByNode(activeNode), [activeNode]);
  const isAuthed = identity !== null;

  /* ── counts per month (for the navigator strip) ───────────────── */
  const monthlyCounts = useMemo(() => {
    const c = new Array(12).fill(0) as number[];
    for (const ev of allEvents) {
      const m = new Date(ev.startAt);
      if (m.getFullYear() === YEAR) c[m.getMonth()]++;
    }
    return c;
  }, [allEvents]);

  /* ── filtered events based on selected month ──────────────────── */
  const filteredEvents = useMemo(() => {
    if (selectedMonth === null) {
      /* "upcoming" — next 90 days */
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

  /* ── identity ─────────────────────────────────────────────────── */

  const handleIdentitySelect = useCallback((personId: string, fullName: string) => {
    persistIdentity(personId, fullName);
    setIdentityState({ personId, fullName, selectedAt: new Date().toISOString() });
  }, []);

  const handleIdentityClear = useCallback(() => {
    clearIdentity();
    setIdentityState(null);
  }, []);

  /* ── RSVP ─────────────────────────────────────────────────────── */

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

  /* ── render ───────────────────────────────────────────────────── */

  const emptyState = filteredEvents.length === 0;

  return (
    <div className="min-h-screen text-gray-900 bg-app-card">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">

        {/* ── nav bar ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 mb-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigateHome}
            className="text-gray-500 hover:text-gray-900 -ml-2 gap-2"
          >
            <ArrowLeft className="size-4" />
            Back to map
          </Button>
          <NodeSwitch activeNode={activeNode} onChange={handleNodeChange} />
        </div>

        {/* ── page heading ────────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-600 mb-2">
            {node.name}
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold leading-tight text-gray-900 font-heading">
            Programming
          </h1>
        </div>

        {/* ── month navigator ─────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 sm:p-8 mb-10">
          <MonthNavigator
            selected={selectedMonth}
            year={YEAR}
            counts={monthlyCounts}
            onChange={setSelectedMonth}
          />
        </div>

        {/* ── identity ────────────────────────────────────────── */}
        <div className="mb-6">
          <IdentityBanner
            identity={identity}
            people={people}
            onSelect={handleIdentitySelect}
            onClear={handleIdentityClear}
          />
        </div>

        {/* Single RSVP hint when not signed in and there are events */}
        {!isAuthed && !emptyState && (
          <p className="text-sm text-gray-500 italic mb-8">
            Select your name above to RSVP to events.
          </p>
        )}

        {/* ── event list ──────────────────────────────────────── */}
        {emptyState ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <Calendar className="size-9 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-medium text-gray-600">
              {selectedMonth === null
                ? "No upcoming events in the next 90 days"
                : "No events this month"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Try a different month or{" "}
              <button
                onClick={() => setSelectedMonth(null)}
                className="text-teal-600 hover:underline font-medium"
              >
                show all upcoming
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-6">
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

        <div className="h-16" aria-hidden />
      </div>
    </div>
  );
}
