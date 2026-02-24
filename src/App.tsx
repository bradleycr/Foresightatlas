import React, { useState, useMemo, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { AppHeader } from "./components/AppHeader";
import { MapView } from "./components/MapView";
import { TimelineView } from "./components/TimelineView";
import { PersonDetailModal } from "./components/PersonDetailModal";
import { Filters, Person, TravelWindow } from "./types";
import { getAllPeople, getAllTravelWindows } from "./services/database";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { Button } from "./components/ui/button";
import { Z_INDEX_LOADING, Z_INDEX_ERROR } from "./constants/zIndex";
import { NodeProgrammingPage } from "./pages/NodeProgrammingPage";
import type { NodeSlug } from "./types/events";
import {
  getRoutePath,
  buildFullPath,
  consumeRedirectPath,
} from "./utils/router";

/**
 * Replace with a real Google Form (or similar) URL when ready.
 * Set to empty string or undefined to hide the button entirely.
 */
const SUGGEST_FORM_URL: string | undefined = undefined;

export default function App() {
  // Base-path-aware routing (works on GitHub Pages e.g. /Foresightmap/)
  const [route, setRoute] = useState(() => getRoutePath());

  // Tab state
  const [activeTab, setActiveTab] = useState<"map" | "timeline">("map");

  // Modal state
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  // Data state
  const [people, setPeople] = useState<Person[]>([]);
  const [travelWindows, setTravelWindows] = useState<TravelWindow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const today = useMemo(() => new Date(), []);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    programs: [],
    focusTags: [],
    nodes: [],
    cities: [],
    showAlumni: true,
    year: today.getFullYear(),
    granularity: "Year",
    referenceDate: today.toISOString(),
    timelineViewMode: "location",
  });
  const [hasInitializedFilters, setHasInitializedFilters] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Restore path after 404 redirect (deep links on GitHub Pages)
  useEffect(() => {
    const stored = consumeRedirectPath();
    if (stored) {
      window.history.replaceState({}, "", stored);
      setRoute(getRoutePath());
    }
  }, []);

  // Keep SPA routing in sync with browser history
  useEffect(() => {
    const handlePop = () => setRoute(getRoutePath());
    const knownRoutes = ["/", "/berlin", "/sf"];
    const current = getRoutePath();
    if (!knownRoutes.includes(current)) {
      window.history.replaceState({}, "", buildFullPath("/"));
      setRoute("/");
    }
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [peopleData, travelWindowsData] = await Promise.all([
        getAllPeople(),
        getAllTravelWindows(),
      ]);
      setPeople(peopleData);
      setTravelWindows(travelWindowsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load data";
      setError(errorMessage);
      toast.error("Failed to load data", { description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────

  const defaultCohortYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    if (people.length === 0) return currentYear;
    const nonAlumni = people.filter((p) => !p.isAlumni);
    const source = nonAlumni.length > 0 ? nonAlumni : people;
    return source.reduce((max, p) => {
      const end = p.fellowshipEndYear ?? p.fellowshipCohortYear;
      return Math.max(max, p.fellowshipCohortYear ?? 0, end ?? 0);
    }, source[0]?.fellowshipCohortYear ?? currentYear);
  }, [people]);

  useEffect(() => {
    if (hasInitializedFilters || people.length === 0) return;
    setFilters((prev) => ({ ...prev, year: defaultCohortYear }));
    setHasInitializedFilters(true);
  }, [defaultCohortYear, hasInitializedFilters, people.length]);

  // ── Filter logic ───────────────────────────────────────────────────

  const filteredPeople = useMemo(() => {
    return people.filter((person) => {
      // Year-based filtering: if a year is selected, only show people active in that year.
      // Alumni are implicitly included when their cohort year range overlaps.
      if (filters.year !== null) {
        const start = person.fellowshipCohortYear;
        const end = person.fellowshipEndYear ?? filters.year;
        if (filters.year < start || filters.year > end) return false;
      }

      if (filters.search) {
        const q = filters.search.toLowerCase();
        const match =
          person.fullName.toLowerCase().includes(q) ||
          (person.affiliationOrInstitution ?? "").toLowerCase().includes(q) ||
          person.shortProjectTagline.toLowerCase().includes(q) ||
          person.currentCity.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (filters.programs.length > 0 && !filters.programs.includes(person.roleType)) return false;
      if (filters.focusTags.length > 0 && !filters.focusTags.some((t) => person.focusTags.includes(t))) return false;
      if (filters.nodes.length > 0 && !filters.nodes.includes(person.primaryNode)) return false;

      if (filters.cities.length > 0) {
        const personCities = [person.currentCity];
        const twCities = travelWindows.filter((tw) => tw.personId === person.id).map((tw) => tw.city);
        if (!filters.cities.some((c) => [...personCities, ...twCities].includes(c))) return false;
      }

      return true;
    });
  }, [people, travelWindows, filters]);

  const filteredTravelWindows = useMemo(() => {
    const ids = new Set(filteredPeople.map((p) => p.id));
    let out = travelWindows.filter((tw) => ids.has(tw.personId));
    if (filters.year !== null) {
      out = out.filter((tw) => {
        const s = new Date(tw.startDate).getFullYear();
        const e = new Date(tw.endDate).getFullYear();
        return s <= filters.year! && e >= filters.year!;
      });
    }
    if (filters.cities.length > 0) out = out.filter((tw) => filters.cities.includes(tw.city));
    return out;
  }, [travelWindows, filteredPeople, filters.cities, filters.year]);

  // ── Time window for map ────────────────────────────────────────────

  const timeWindowStart = useMemo(() => {
    if (filters.year === null) {
      if (filters.granularity === "Month" || filters.granularity === "Week") {
        const ref = new Date(filters.referenceDate);
        const m = ref.getMonth(), d = ref.getDate();
        if (filters.granularity === "Month") return new Date(ref.getFullYear(), m, 1);
        const base = new Date(ref.getFullYear(), m, d);
        base.setDate(base.getDate() - base.getDay());
        return base;
      }
      return new Date(1900, 0, 1);
    }
    const ref = new Date(filters.referenceDate);
    const m = ref.getMonth(), d = ref.getDate();
    if (filters.granularity === "Month") return new Date(filters.year, m, 1);
    if (filters.granularity === "Week") {
      const base = new Date(filters.year, m, d);
      base.setDate(base.getDate() - base.getDay());
      return base;
    }
    return new Date(filters.year, 0, 1);
  }, [filters.year, filters.granularity, filters.referenceDate]);

  const timeWindowEnd = useMemo(() => {
    if (filters.year === null) {
      if (filters.granularity === "Month" || filters.granularity === "Week") {
        const ref = new Date(filters.referenceDate);
        const m = ref.getMonth(), d = ref.getDate();
        if (filters.granularity === "Month") return new Date(ref.getFullYear(), m + 1, 0, 23, 59, 59, 999);
        const base = new Date(ref.getFullYear(), m, d);
        base.setDate(base.getDate() + (6 - base.getDay()));
        base.setHours(23, 59, 59, 999);
        return base;
      }
      return new Date(2100, 11, 31);
    }
    const ref = new Date(filters.referenceDate);
    const m = ref.getMonth(), d = ref.getDate();
    if (filters.granularity === "Month") return new Date(filters.year, m + 1, 0, 23, 59, 59, 999);
    if (filters.granularity === "Week") {
      const base = new Date(filters.year, m, d);
      base.setDate(base.getDate() + (6 - base.getDay()));
      base.setHours(23, 59, 59, 999);
      return base;
    }
    return new Date(filters.year, 11, 31, 23, 59, 59, 999);
  }, [filters.year, filters.granularity, filters.referenceDate]);

  // ── Navigation ─────────────────────────────────────────────────────

  const navigate = useCallback((path: string) => {
    if (path === route) return;
    const fullPath = buildFullPath(path);
    window.history.pushState({}, "", fullPath);
    setRoute(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [route]);

  /**
   * When "Show on map" is tapped on the programming page, navigate
   * home and constrain the visible people to those who RSVP'd "going".
   */
  const handleShowEventOnMap = useCallback(
    (_eventId: string, goingPersonIds: string[]) => {
      if (goingPersonIds.length === 0) return;
      setMapFilterIds(new Set(goingPersonIds));
      setActiveTab("map");
      navigate("/");
    },
    [navigate],
  );

  // ── Map overlay filter (set from programming page) ────────────────

  const [mapFilterIds, setMapFilterIds] = useState<Set<string> | null>(null);

  const mapPeople = useMemo(() => {
    if (!mapFilterIds) return filteredPeople;
    return filteredPeople.filter((p) => mapFilterIds.has(p.id));
  }, [filteredPeople, mapFilterIds]);

  // ── Views ──────────────────────────────────────────────────────────

  const homeView = (
    <div className="h-screen flex flex-col bg-gray-50">
      <AppHeader
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setMapFilterIds(null);
        }}
        suggestFormUrl={SUGGEST_FORM_URL}
        onNavigateNode={(slug) => navigate(`/${slug}`)}
      />

      {/* Event filter banner — shown when returning from programming page */}
      {mapFilterIds && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-sm text-blue-700">
            Showing <strong>{mapFilterIds.size}</strong> attendee{mapFilterIds.size !== 1 && "s"} from event RSVP
          </p>
          <button
            onClick={() => setMapFilterIds(null)}
            className="text-xs text-blue-600 hover:text-blue-800 underline transition-colors"
          >
            Clear filter
          </button>
        </div>
      )}

      <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-hidden">
        {activeTab === "map" ? (
          <MapView
            filteredPeople={mapPeople}
            filteredTravelWindows={filteredTravelWindows}
            timeWindowStart={timeWindowStart}
            timeWindowEnd={timeWindowEnd}
            granularity={filters.granularity}
            onViewPersonDetails={(id) => setSelectedPersonId(id)}
            filters={filters}
            onFiltersChange={setFilters}
            defaultYear={defaultCohortYear}
          />
        ) : (
          <TimelineView
            timelineViewMode={filters.timelineViewMode}
            filteredPeople={filteredPeople}
            filteredTravelWindows={filteredTravelWindows}
            year={filters.year}
            granularity={filters.granularity}
            referenceDate={filters.referenceDate}
            cities={filters.cities}
            nodes={filters.nodes}
            onViewPersonDetails={(id) => setSelectedPersonId(id)}
            onSwitchToMap={() => setActiveTab("map")}
          />
        )}
      </div>
    </div>
  );

  const nodeSlug = route === "/berlin" ? "berlin" : route === "/sf" ? "sf" : null;

  const programmingView = nodeSlug ? (
    <NodeProgrammingPage
      initialNode={nodeSlug as NodeSlug}
      people={people}
      onNavigateHome={() => navigate("/")}
      onNavigateNode={(slug) => navigate(`/${slug}`)}
      onShowEventOnMap={handleShowEventOnMap}
    />
  ) : null;

  return (
    <>
      {programmingView ?? homeView}

      <PersonDetailModal
        person={people.find((p) => p.id === selectedPersonId) || null}
        travelWindows={travelWindows}
        allPeople={filteredPeople}
        isOpen={selectedPersonId !== null}
        isAdmin={false}
        onClose={() => setSelectedPersonId(null)}
        onNavigate={(id) => setSelectedPersonId(id)}
        onDataUpdate={loadData}
      />

      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center" style={{ zIndex: Z_INDEX_LOADING }}>
          <div className="bg-white rounded-lg p-6 shadow-lg">
            <p className="text-gray-900 font-medium">Loading data...</p>
          </div>
        </div>
      )}

      {error && !isLoading && (
        <div
          className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-900 px-4 py-3 rounded-lg shadow-lg max-w-md"
          style={{ zIndex: Z_INDEX_ERROR }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="font-semibold text-red-900 mb-1">Error loading data</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0" aria-label="Dismiss error">
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => { setError(null); loadData(); }} size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
              Retry
            </Button>
          </div>
        </div>
      )}

      <Toaster />
    </>
  );
}
