/**
 * Node Programming Page — events hub + "The Table" check-in for each node.
 *
 * Two tabs:
 *   1. Events  — calendar of upcoming programming (existing)
 *   2. The Table — week-view grid showing who is at the node each day
 *
 * Design language mirrors the main Fellows Map's pastel-gradient sidebar:
 * white cards with subtle borders/shadows, node-specific pastel accents,
 * and a soft gradient tint on the page header.
 *
 * Berlin → indigo–rose palette  |  SF → amber–sky palette
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, Sparkles, CalendarDays, Users, ShieldCheck, UserCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import foresightIconUrl from "../assets/Foresight_RGB_Icon_Black.png?url";
import { NodeSlug, NodeEvent, RSVPStatus } from "../types/events";
import { Person } from "../types";
import { getNode, getProgrammingPageConfig } from "../data/nodes";
import { getEventsByNodeForDisplay, loadEvents } from "../data/events";
import type { Identity } from "../services/identity";
import {
  setRSVP,
  removeRSVP,
  getRSVP,
  getEventRSVPSummary,
  fetchRSVPsFromAPI,
  setAPIRsvpsFromBuild,
} from "../services/rsvp";
import {
  fetchCheckInsFromAPI,
  checkIn as doCheckIn,
  getWeekDates,
  toDateKey,
} from "../services/checkin";
import { getRsvps } from "../services/database";
import { MonthNavigator } from "../components/programming/MonthNavigator";
import { EventCard } from "../components/programming/EventCard";
import { NodeTableView } from "../components/programming/NodeTableView";
import { QRCheckIn } from "../components/programming/QRCheckIn";
import { cn } from "../components/ui/utils";
import { toast } from "sonner";

type PageTab = "events" | "table";

/** Check-in table (The Table) is on for Berlin and SF. Set to false to hide the tab until Signal/etc. is ready. */
const ENABLE_CHECKIN_TABLE = true;

const YEAR = 2026;
const UPCOMING_DAYS = 90;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Read ?tab= and ?checkin= from the current URL once. */
function readUrlParams(): { tab: PageTab; autoCheckIn: boolean } {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab") === "table" ? "table" : "events";
  const autoCheckIn = params.get("checkin") === "true";
  return { tab, autoCheckIn };
}

/** Strip query params after we've consumed them so they don't re-trigger. */
function clearUrlParams() {
  const url = new URL(window.location.href);
  if (url.searchParams.has("tab") || url.searchParams.has("checkin")) {
    url.searchParams.delete("tab");
    url.searchParams.delete("checkin");
    window.history.replaceState({}, "", url.toString());
  }
}

interface NodeProgrammingPageProps {
  initialNode: NodeSlug;
  people: Person[];
  identity: Identity | null;
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
  identity,
  onNavigateHome,
  onNavigateNode,
  onShowEventOnMap,
  onViewPersonDetails,
  showPageHeader = true,
}: NodeProgrammingPageProps) {
  const [activeNode, setActiveNode] = useState<NodeSlug>(initialNode);
  const [rsvpTick, setRsvpTick] = useState(0);
  const [checkInTick, setCheckInTick] = useState(0);
  const [dynamicEvents, setDynamicEvents] = useState<NodeEvent[] | null>(null);
  const [showQR, setShowQR] = useState(false);

  const isGlobal = activeNode === "global";
  const isPhysicalNode = (activeNode === "berlin" || activeNode === "sf") && ENABLE_CHECKIN_TABLE;

  /* ── Tab state (URL param aware) ─────────────────────────────────── */
  const urlParams = useRef(readUrlParams());
  const [activeTab, setActiveTab] = useState<PageTab>(urlParams.current.tab);
  const autoCheckInHandled = useRef(false);

  useEffect(() => {
    setActiveNode(initialNode);
  }, [initialNode]);

  useEffect(() => {
    if (!isPhysicalNode && activeTab === "table") setActiveTab("events");
  }, [isPhysicalNode, activeTab]);

  /* ── Data loading ────────────────────────────────────────────────── */

  useEffect(() => {
    (async () => {
      const buildRsvps = await getRsvps();
      setAPIRsvpsFromBuild(buildRsvps);
      await fetchRSVPsFromAPI();
      setRsvpTick((t) => t + 1);
    })();
    loadEvents().then(setDynamicEvents);
  }, []);

  useEffect(() => {
    if (isGlobal) return;
    const weekDates = getWeekDates(new Date());
    void fetchCheckInsFromAPI(activeNode, weekDates[0], weekDates[6]).then(() =>
      setCheckInTick((t) => t + 1),
    );
  }, [activeNode, isGlobal]);

  /* ── QR auto-check-in flow ───────────────────────────────────────── */

  useEffect(() => {
    if (!urlParams.current.autoCheckIn) return;
    if (!identity) return;
    if (autoCheckInHandled.current) return;
    if (isGlobal) return;
    autoCheckInHandled.current = true;
    clearUrlParams();

    const today = toDateKey(new Date());
    void doCheckIn(identity.personId, identity.fullName, activeNode, today, "checkin").then(() => {
      setCheckInTick((t) => t + 1);
      toast.success(`Checked in at ${getNode(activeNode)?.city ?? activeNode}!`, {
        description: `Welcome, ${identity.fullName}`,
      });
    });
  }, [activeNode, identity, isGlobal]);

  useEffect(() => {
    if (!urlParams.current.autoCheckIn) return;
    if (identity) return;
    toast.message("Sign in to finish check-in", {
      description: "Use the Profile button in the top right, then we'll complete your node check-in.",
    });
  }, [identity]);

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const eventsTopRef = useRef<HTMLDivElement>(null);

  const node = getProgrammingPageConfig(activeNode)!;
  const allEvents = useMemo(
    () => getEventsByNodeForDisplay(activeNode, dynamicEvents),
    [activeNode, dynamicEvents],
  );
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

  /* ── RSVP handlers ──────────────────────────────────────────────── */

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

  // When user switches month (grid or prev/next), scroll back to top so they see the new month from the start.
  useEffect(() => {
    if (selectedMonth !== null && eventsTopRef.current) {
      eventsTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedMonth]);

  const openProfile = useCallback(
    (personId: string, peopleIds: string[], label: string) => {
      if (!onViewPersonDetails) return;
      onViewPersonDetails(personId, { peopleIds, label });
    },
    [onViewPersonDetails],
  );

  const { theme } = node;
  const pageShellClassName = "w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8";

  const headerStyle = {
    background: `linear-gradient(to bottom, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.82) 100%), ${theme.headerGradient}`,
    backgroundBlendMode: "normal",
  } as React.CSSProperties;

  /* ── Tab bar ─────────────────────────────────────────────────────── */

  const tabTabs: { id: PageTab; label: string; icon: typeof CalendarDays }[] = [
    { id: "events", label: "Events", icon: CalendarDays },
    ...(isPhysicalNode ? [{ id: "table" as PageTab, label: "The Table", icon: Users }] : []),
  ];

  const tabBar = (
    <div className={cn("flex-shrink-0 sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm", pageShellClassName)}>
      <div className="flex gap-1">
        {tabTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              theme.focusRing,
              activeTab === id
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            <Icon className="size-4" />
            {label}
            {activeTab === id && (
              <span
                className={cn(
                  "absolute bottom-0 left-2 right-2 h-0.5 rounded-full",
                  node.slug === "berlin" ? "bg-indigo-500" : node.slug === "sf" ? "bg-sky-500" : "bg-teal-500",
                )}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div className={`bg-gray-100 flex flex-col ${showPageHeader ? "min-h-screen" : "flex-1 min-h-0 overflow-auto w-full min-w-0"}`}>
      {showPageHeader ? (
        <header className="border-b border-gray-200 flex-shrink-0" style={headerStyle}>
          <div className={cn(pageShellClassName, "py-4 sm:py-5")}>
            <div className="mb-4">
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
        <div className="border-b border-gray-200 flex-shrink-0" style={headerStyle}>
          <div className={cn(pageShellClassName, "py-4 sm:py-5")}>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight mb-1 sm:mb-1.5">
              {node.city} Programming
            </h1>
            <p className="text-sm text-gray-600 max-w-lg leading-relaxed">
              {node.description}
            </p>
          </div>
        </div>
      )}

      {/* Tab bar — Events + The Table (Berlin/SF when ENABLE_CHECKIN_TABLE is true) */}
      {isPhysicalNode ? tabBar : null}

      {/* Content */}
      <div className="w-full min-w-0">
        <div className={cn(
          pageShellClassName,
          activeTab === "table" ? "py-6 sm:py-8 space-y-6 sm:space-y-8" : "py-6 sm:py-8 space-y-8 sm:space-y-10",
        )}>

        {(activeTab === "table" || !identity) && (
          <DirectoryStatusBanner
            identity={identity}
            theme={theme}
            mode={activeTab}
          />
        )}

        {activeTab === "events" ? (
          /* ── Events tab ────────────────────────────────────────────── */
          <>
            <div ref={eventsTopRef} className="rounded-2xl border border-gray-200 shadow p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden" style={{ background: theme.headerGradient }}>
              <MonthNavigator
                selected={selectedMonth}
                year={YEAR}
                counts={monthlyCounts}
                onChange={setSelectedMonth}
                theme={theme}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">{sectionLabel}</h2>
              <span className="text-xs text-gray-400 tabular-nums">
                {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
              </span>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow p-12 sm:p-16 text-center">
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
                    onPersonClick={(personId) => openProfile(personId, summaryOf(ev.id).goingPersonIds, "Going to this event")}
                    theme={theme}
                  />
                ))}
              </div>
            )}
            {/* Prev/next month — show whenever a single month is selected, even if that month has no events */}
            {selectedMonth !== null && (
              <MonthNavBar
                selectedMonth={selectedMonth}
                monthlyCounts={monthlyCounts}
                onSelectMonth={setSelectedMonth}
                theme={theme}
              />
            )}
          </>
        ) : (
          /* ── The Table (check-in) — who's at the node today; no Signal bot required ── */
          <NodeTableView
            nodeSlug={activeNode}
            theme={theme}
            identity={identity}
            people={people}
            tick={checkInTick}
            onTick={() => setCheckInTick((t) => t + 1)}
            onPersonClick={(personId, dayPeopleIds) =>
              openProfile(personId, dayPeopleIds, "At the node")
            }
            onShowQR={() => setShowQR(true)}
          />
        )}

        <div className="h-12 sm:h-16" aria-hidden />
        </div>
      </div>

      {/* QR code modal — only for physical nodes */}
      {showQR && !isGlobal && (
        <QRCheckIn
          nodeSlug={activeNode}
          nodeName={node.city + " Node"}
          theme={theme}
          onClose={() => setShowQR(false)}
        />
      )}
    </div>
  );
}

/** Short month labels for prev/next bar */
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Bar at the bottom of a month's event list: Previous month | Next month.
 * Lets users flip to adjacent months without scrolling back to the top.
 */
function MonthNavBar({
  selectedMonth,
  monthlyCounts,
  onSelectMonth,
  theme,
}: {
  selectedMonth: number;
  monthlyCounts: number[];
  onSelectMonth: (m: number | null) => void;
  theme: ReturnType<typeof getNode>["theme"];
}) {
  const prevMonth = selectedMonth - 1;
  const nextMonth = selectedMonth + 1;
  const hasPrev = prevMonth >= 0;
  const hasNext = nextMonth <= 11;

  return (
    <nav
      className="flex items-center justify-between gap-4 pt-6 sm:pt-8 pb-2 border-t border-gray-200 mt-6 sm:mt-8"
      aria-label="Navigate to adjacent month"
    >
      {hasPrev ? (
        <button
          type="button"
          onClick={() => onSelectMonth(prevMonth)}
          className={cn(
            "inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-4 py-2.5 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            theme.focusRing,
            "text-gray-700 hover:text-gray-900 hover:bg-gray-100",
          )}
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          <span>{MONTH_SHORT[prevMonth]}</span>
          {monthlyCounts[prevMonth] > 0 && (
            <span className="text-xs text-gray-400 tabular-nums">
              {monthlyCounts[prevMonth]} event{monthlyCounts[prevMonth] !== 1 ? "s" : ""}
            </span>
          )}
        </button>
      ) : (
        <div aria-hidden />
      )}
      {hasNext ? (
        <button
          type="button"
          onClick={() => onSelectMonth(nextMonth)}
          className={cn(
            "inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-4 py-2.5 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            theme.focusRing,
            "text-gray-700 hover:text-gray-900 hover:bg-gray-100 ml-auto",
          )}
        >
          <span>{MONTH_SHORT[nextMonth]}</span>
          {monthlyCounts[nextMonth] > 0 && (
            <span className="text-xs text-gray-400 tabular-nums">
              {monthlyCounts[nextMonth]} event{monthlyCounts[nextMonth] !== 1 ? "s" : ""}
            </span>
          )}
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </button>
      ) : (
        <div aria-hidden />
      )}
    </nav>
  );
}

function DirectoryStatusBanner({
  identity,
  theme,
  mode,
}: {
  identity: Identity | null;
  theme: ReturnType<typeof getNode>["theme"];
  mode: PageTab;
}) {
  if (identity) {
    const initials = identity.fullName
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return (
      <div className="rounded-2xl border border-gray-200 px-5 py-4 shadow sm:px-6 sm:py-5 overflow-hidden" style={{ background: theme.headerGradient }}>
        <div className="flex items-center gap-4">
          <div
            className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/50 shadow-sm"
            style={{ background: theme.headerGradient }}
          >
            <img src={foresightIconUrl} alt="" className="pointer-events-none absolute inset-0 size-full object-contain p-0.5 opacity-50 scale-125" aria-hidden />
            <span className={cn("relative z-10 text-[10px] font-medium", theme.avatarActiveText, "opacity-90")}>
              {initials}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 sm:text-base">
              {identity.fullName}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {mode === "table"
                ? "Signed in for check-ins. Use Profile (top right) to manage your account."
                : "Signed in for RSVPs. Use Profile (top right) to manage your account."}
            </p>
          </div>
          <ShieldCheck className={cn("hidden size-5 shrink-0 sm:block", theme.avatarActiveText)} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 px-5 py-4 shadow sm:px-6 sm:py-5 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.9) 100%)" }}>
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-gray-200/80 shadow-sm bg-gradient-to-br from-gray-100 to-gray-200 text-gray-500">
          <UserCircle2 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 sm:text-base">
            Sign in (Profile, top right)
          </p>
          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            {mode === "table"
              ? "Sign in once, then return here to mark yourself at the node."
              : "Sign in once, then RSVP on events below."}
          </p>
        </div>
      </div>
    </div>
  );
}
