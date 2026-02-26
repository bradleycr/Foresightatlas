/**
 * Node Programming Page — events hub for each Foresight node.
 *
 * Design language mirrors the main Fellows Map's pastel-gradient sidebar:
 * white cards with subtle borders/shadows, node-specific pastel accents,
 * and a soft gradient tint on the page header.
 *
 * Berlin → violet–rose palette  |  SF → amber–sky palette
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { NodeSlug, NodeEvent, RSVPStatus } from "../types/events";
import { Person } from "../types";
import { getNode } from "../data/nodes";
import { getEventsByNode, loadEvents } from "../data/events";
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
  fetchRSVPsFromAPI,
  setAPIRsvpsFromBuild,
} from "../services/rsvp";
import { getRsvps } from "../services/database";
import { IdentityBanner } from "../components/programming/IdentityBanner";
import { MonthNavigator } from "../components/programming/MonthNavigator";
import { EventCard } from "../components/programming/EventCard";

const YEAR = 2026;
const UPCOMING_DAYS = 90;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface NodeProgrammingPageProps {
  initialNode: NodeSlug;
  people: Person[];
  onNavigateHome: () => void;
  onNavigateNode: (slug: NodeSlug) => void;
  onShowEventOnMap?: (eventId: string, goingPersonIds: string[]) => void;
  onViewPersonDetails?: (personId: string, context: { peopleIds: string[]; label: string }) => void;
  /** When false, the page does not render its own header (global AppHeader is shown above). */
  showPageHeader?: boolean;
}

export function NodeProgrammingPage({
  initialNode,
  people,
  onNavigateHome,
  onNavigateNode,
  onShowEventOnMap,
  onViewPersonDetails,
  showPageHeader = true,
}: NodeProgrammingPageProps) {
  const [activeNode, setActiveNode] = useState<NodeSlug>(initialNode);
  const [identity, setIdentityState] = useState(() => getIdentity());
  const [rsvpTick, setRsvpTick] = useState(0);
  const [dynamicEvents, setDynamicEvents] = useState<NodeEvent[] | null>(null);

  useEffect(() => {
    setActiveNode(initialNode);
  }, [initialNode]);

  useEffect(() => {
    (async () => {
      const buildRsvps = await getRsvps();
      setAPIRsvpsFromBuild(buildRsvps);
      await fetchRSVPsFromAPI();
      setRsvpTick((t) => t + 1);
    })();
    loadEvents().then(setDynamicEvents);
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const node = getNode(activeNode)!;
  const allEvents = useMemo(() => {
    const source = dynamicEvents ?? getEventsByNode(activeNode);
    if (dynamicEvents) return source.filter((e) => e.nodeSlug === activeNode);
    return source;
  }, [activeNode, dynamicEvents]);
  const isAuthed = identity !== null;

  const monthlyCounts = useMemo(() => {
    const c = new Array(12).fill(0) as number[];
    for (const ev of allEvents) {
      const m = new Date(ev.startAt);
      if (m.getFullYear() === YEAR) c[m.getMonth()]++;
    }
    return c;
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    if (selectedMonth === null) {
      const now = Date.now();
      const cut = now + UPCOMING_DAYS * 24 * 60 * 60 * 1000;
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

  const handleIdentitySelect = useCallback((personId: string, fullName: string) => {
    persistIdentity(personId, fullName);
    setIdentityState({ personId, fullName, selectedAt: new Date().toISOString() });
  }, []);

  const handleIdentityClear = useCallback(() => {
    clearIdentity();
    setIdentityState(null);
  }, []);

  const handleRSVPChange = useCallback(
    (eventId: string, status: RSVPStatus | null, eventTitle?: string) => {
      if (!identity) return;
      if (status === null) {
        removeRSVP(eventId, identity.personId);
      } else {
        void setRSVP(eventId, identity.personId, status, identity.fullName, eventTitle);
      }
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

  const sectionLabel = selectedMonth === null
    ? "Upcoming Events"
    : `${MONTH_NAMES[selectedMonth]} Events`;

  const openRsvpProfile = useCallback(
    (personId: string, rsvpPeopleIds: string[]) => {
      if (!onViewPersonDetails) return;
      onViewPersonDetails(personId, {
        peopleIds: rsvpPeopleIds,
        label: "RSVP attendees",
      });
    },
    [onViewPersonDetails],
  );

  const { theme } = node;

  // Shared header gradient — white overlay softens the pastel tint so text stays crisp
  const headerStyle = {
    background: `linear-gradient(to bottom, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.92) 100%), ${theme.headerGradient}`,
    backgroundBlendMode: "normal",
  } as React.CSSProperties;

  return (
    <div className={`bg-gray-50 flex flex-col ${showPageHeader ? "min-h-screen" : "flex-1 min-h-0 overflow-auto w-full min-w-0"}`}>
      {showPageHeader ? (
        /* Full page header with "Back to map" — standalone route */
        <header className="border-b border-gray-200 flex-shrink-0" style={headerStyle}>
          <div className="w-full max-w-3xl mx-auto px-6 sm:px-8 py-4 sm:py-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <button
                onClick={onNavigateHome}
                className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="size-4" />
                Back to map
              </button>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight mb-1 sm:mb-1.5">
              {node.city} Programming
            </h1>
            <p className="text-sm text-gray-600 max-w-lg leading-relaxed">
              {node.description}
            </p>
          </div>
        </header>
      ) : (
        /* Subhead only — global AppHeader is shown above; node switch is in header dropdown */
        <div className="border-b border-gray-200 flex-shrink-0" style={headerStyle}>
          <div className="w-full max-w-3xl mx-auto px-6 sm:px-8 py-4 sm:py-5">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight mb-1 sm:mb-1.5">
              {node.city} Programming
            </h1>
            <p className="text-sm text-gray-600 max-w-lg leading-relaxed">
              {node.description}
            </p>
          </div>
        </div>
      )}

      {/* Content — stable width so layout doesn’t jump when switching months or nodes */}
      <div className="w-full min-w-0">
        <div className="w-full max-w-3xl mx-auto px-6 sm:px-8 py-6 sm:py-8 space-y-8 sm:space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
          <IdentityBanner
            identity={identity}
            people={people}
            onSelect={handleIdentitySelect}
            onClear={handleIdentityClear}
            theme={theme}
          />
        </div>

        {/* Month navigator */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <MonthNavigator
            selected={selectedMonth}
            year={YEAR}
            counts={monthlyCounts}
            onChange={setSelectedMonth}
            theme={theme}
          />
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between pt-2">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">{sectionLabel}</h2>
          <span className="text-xs text-gray-400 tabular-nums">
            {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Event list */}
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 sm:p-16 text-center">
            <Sparkles className="size-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">
              {selectedMonth === null
                ? `No upcoming events in the next ${UPCOMING_DAYS} days`
                : `No events in ${MONTH_NAMES[selectedMonth]}`}
            </p>
            <p className="text-xs text-gray-400 mt-1.5">
              {selectedMonth === null ? (
                "Try selecting a month above."
              ) : (
                <>
                  Try a different month or{" "}
                  <button
                    type="button"
                    onClick={() => setSelectedMonth(null)}
                    className={`font-medium hover:underline ${theme.linkText}`}
                  >
                    view all upcoming
                  </button>
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
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
                onPersonClick={(personId) => openRsvpProfile(personId, summaryOf(ev.id).goingPersonIds)}
                theme={theme}
              />
            ))}
          </div>
        )}

        <div className="h-12 sm:h-16" aria-hidden />
        </div>
      </div>
    </div>
  );
}
