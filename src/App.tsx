import { useState, useMemo, useEffect } from "react";
import { AppHeader } from "./components/AppHeader";
import { FiltersBar } from "./components/FiltersBar";
import { MapView } from "./components/MapView";
import { TimelineView } from "./components/TimelineView";
import { SuggestUpdateModal } from "./components/SuggestUpdateModal";
import { AdminLoginModal } from "./components/AdminLoginModal";
import { AdminPanel } from "./components/AdminPanel";
import { Filters, Person, TravelWindow, LocationSuggestion } from "./types";
import {
  getAllPeople,
  getAllTravelWindows,
  getAllSuggestions,
  addSuggestion,
  updateSuggestionStatus,
  getAdminUsers,
  generateSuggestionId,
} from "./services/database";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"map" | "timeline">("map");

  // Modal states
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Auth state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);

  // Data state
  const [people, setPeople] = useState<Person[]>([]);
  const [travelWindows, setTravelWindows] = useState<TravelWindow[]>([]);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const today = new Date();
  const currentYear = today.getFullYear();
  const [filters, setFilters] = useState<Filters>({
    search: "",
    programs: [],
    focusTags: [],
    nodes: [],
    cities: [],
    year: currentYear, // Can be null for "All time"
    granularity: "Year",
    referenceDate: today.toISOString(),
    timelineViewMode: "person", // Default to person view
  });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Load all data from database
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [peopleData, travelWindowsData, suggestionsData] = await Promise.all([
        getAllPeople(),
        getAllTravelWindows(),
        getAllSuggestions(),
      ]);
      setPeople(peopleData);
      setTravelWindows(travelWindowsData);
      setSuggestions(suggestionsData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load data";
      setError(errorMessage);
      toast.error("Failed to load data", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Extract all unique cities from the database
  const availableCities = useMemo(() => {
    const citySet = new Set<string>();
    
    // Add cities from people (home base and current)
    people.forEach((person) => {
      if (person.homeBaseCity) citySet.add(person.homeBaseCity);
      if (person.currentCity) citySet.add(person.currentCity);
    });
    
    // Add cities from travel windows
    travelWindows.forEach((tw) => {
      if (tw.city) citySet.add(tw.city);
    });
    
    // Return sorted array for consistent display
    return Array.from(citySet).sort();
  }, [people, travelWindows]);

  // Filter logic
  const filteredPeople = useMemo(() => {
    return people.filter((person) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          person.fullName.toLowerCase().includes(searchLower) ||
          person.shortProjectTagline.toLowerCase().includes(searchLower) ||
          person.currentCity.toLowerCase().includes(searchLower) ||
          person.homeBaseCity.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // Program filter
      if (filters.programs.length > 0 && !filters.programs.includes(person.roleType)) {
        return false;
      }

      // Focus tags filter
      if (
        filters.focusTags.length > 0 &&
        !filters.focusTags.some((tag) => person.focusTags.includes(tag))
      ) {
        return false;
      }

      // Node filter
      if (filters.nodes.length > 0 && !filters.nodes.includes(person.primaryNode)) {
        return false;
      }

      // City filter - check if person's current city, home base city, or any travel window city matches
      if (filters.cities.length > 0) {
        const personCities = [person.currentCity, person.homeBaseCity];
        const personTravelCities = travelWindows
          .filter((tw) => tw.personId === person.id)
          .map((tw) => tw.city);
        const allPersonCities = [...personCities, ...personTravelCities];
        
        if (!filters.cities.some((city) => allPersonCities.includes(city))) {
          return false;
        }
      }

      return true;
    });
  }, [people, travelWindows, filters]);

  const filteredTravelWindows = useMemo(() => {
    const personIds = new Set(filteredPeople.map((p) => p.id));
    let filtered = travelWindows.filter((tw) => personIds.has(tw.personId));
    
    // Filter out travel windows that are too far in the future (beyond next year)
    // This prevents showing data for years that don't exist yet
    const currentYear = new Date().getFullYear();
    const maxAllowedYear = currentYear + 1;
    filtered = filtered.filter((tw) => {
      const startYear = new Date(tw.startDate).getFullYear();
      const endYear = new Date(tw.endDate).getFullYear();
      // Only show if the travel window is within the allowed range
      return startYear <= maxAllowedYear && endYear <= maxAllowedYear;
    });
    
    // Apply city filter to travel windows if cities are selected
    if (filters.cities.length > 0) {
      filtered = filtered.filter((tw) => filters.cities.includes(tw.city));
    }
    
    return filtered;
  }, [travelWindows, filteredPeople, filters.cities]);

  // Time window for map view
  const timeWindowStart = useMemo(() => {
    // "All time" - use a very early date
    if (filters.year === null) {
      return new Date(1900, 0, 1);
    }

    const ref = new Date(filters.referenceDate);
    const month = ref.getMonth();
    const day = ref.getDate();

    if (filters.granularity === "Month") {
      return new Date(ref.getFullYear(), month, 1);
    }

    if (filters.granularity === "Week") {
      const base = new Date(ref.getFullYear(), month, day);
      const startOfWeek = new Date(base);
      startOfWeek.setDate(base.getDate() - base.getDay());
      return startOfWeek;
    }

    return new Date(filters.year, 0, 1);
  }, [filters.year, filters.granularity, filters.referenceDate]);

  const timeWindowEnd = useMemo(() => {
    // "All time" - use a very far future date
    if (filters.year === null) {
      return new Date(2100, 11, 31);
    }

    const ref = new Date(filters.referenceDate);
    const month = ref.getMonth();
    const day = ref.getDate();

    if (filters.granularity === "Month") {
      return new Date(ref.getFullYear(), month + 1, 0);
    }

    if (filters.granularity === "Week") {
      const base = new Date(ref.getFullYear(), month, day);
      const endOfWeek = new Date(base);
      const daysToAdd = 6 - endOfWeek.getDay();
      endOfWeek.setDate(base.getDate() + daysToAdd);
      return endOfWeek;
    }

    return new Date(filters.year, 11, 31);
  }, [filters.year, filters.granularity, filters.referenceDate]);

  // Handle reset to current 12 months
  const handleResetToCurrent12Months = () => {
    const now = new Date();
    setFilters({
      ...filters,
      year: now.getFullYear(),
      granularity: "Year",
      cities: [], // Clear city filter on reset
      referenceDate: now.toISOString(),
    });
  };

  // Handle admin login
  const handleAdminLogin = async (
    email: string,
    password: string
  ): Promise<boolean> => {
    try {
      // Check against database admin users
      const adminUsers = await getAdminUsers();
      const admin = adminUsers.find(
        (u) => u.email === email && u.passwordPlaceholder === password
      );

      if (admin) {
        setIsAdmin(true);
        setAdminUser(admin);
        setShowAdminLogin(false);
        return true;
      }

      return false;
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Failed to authenticate", {
        description: "Unable to verify credentials. Please try again.",
      });
      return false;
    }
  };

  // Handle logout
  const handleLogout = () => {
    setIsAdmin(false);
    setAdminUser(null);
    toast.success("Logged out successfully");
  };

  // Handle suggestion submission
  const handleSuggestionSubmit = async (suggestionData: any) => {
    try {
      const suggestion: LocationSuggestion = {
        ...suggestionData,
        id: generateSuggestionId(),
        createdAt: new Date().toISOString(),
        status: "Pending",
      };
      await addSuggestion(suggestion);
      toast.success("Suggestion submitted successfully");
      setShowSuggestModal(false);
      await loadData(); // Refresh data
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to submit suggestion";
      toast.error("Failed to submit suggestion", {
        description: errorMessage,
      });
    }
  };

  // Handle suggestion acceptance
  const handleAcceptSuggestion = async (id: string) => {
    try {
      const suggestion = suggestions.find((s) => s.id === id);
      if (!suggestion) {
        throw new Error("Suggestion not found");
      }

      await updateSuggestionStatus(id, "Accepted");

      // Apply the changes based on suggestion type
      // This is a simplified version - in production you'd want more robust parsing
      if (suggestion.requestedChangeType === "Add travel window") {
        // Would need to parse and add travel window
        // For now, just update status
      } else if (suggestion.requestedChangeType === "Update location") {
        // Would need to parse and update person location
        // For now, just update status
      }

      toast.success("Suggestion accepted");
      await loadData(); // Refresh data
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to accept suggestion";
      toast.error("Failed to accept suggestion", {
        description: errorMessage,
      });
    }
  };

  // Handle suggestion rejection
  const handleRejectSuggestion = async (id: string) => {
    try {
      await updateSuggestionStatus(id, "Rejected");
      toast.success("Suggestion rejected");
      await loadData(); // Refresh data
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to reject suggestion";
      toast.error("Failed to reject suggestion", {
        description: errorMessage,
      });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <AppHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAdmin={isAdmin}
        adminName={adminUser?.displayName}
        onAdminClick={() => setShowAdminLogin(true)}
        onLogout={handleLogout}
        onAdminPanelClick={() => setShowAdminPanel(true)}
        onSuggestUpdateClick={() => setShowSuggestModal(true)}
      />

      {/* Filters */}
      <FiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        onReset={handleResetToCurrent12Months}
        availableCities={availableCities}
        activeTab={activeTab}
      />

      {/* Content Area */}
      <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-hidden">
        {activeTab === "map" ? (
          <MapView
            filteredPeople={filteredPeople}
            filteredTravelWindows={filteredTravelWindows}
            timeWindowStart={timeWindowStart}
            timeWindowEnd={timeWindowEnd}
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
          />
        )}
      </div>

      {/* Modals */}
      {showSuggestModal && (
        <SuggestUpdateModal
          onClose={() => setShowSuggestModal(false)}
          onSubmit={handleSuggestionSubmit}
          people={people}
        />
      )}

      {showAdminLogin && (
        <AdminLoginModal
          onClose={() => setShowAdminLogin(false)}
          onLogin={handleAdminLogin}
        />
      )}

      {showAdminPanel && (
        <AdminPanel
          people={people}
          travelWindows={travelWindows}
          suggestions={suggestions}
          onAccept={handleAcceptSuggestion}
          onReject={handleRejectSuggestion}
          onPersonUpdate={async () => {
            await loadData();
            toast.success("Person updated successfully");
          }}
          onPersonDelete={async () => {
            await loadData();
            toast.success("Person deleted successfully");
          }}
          onTravelWindowUpdate={async () => {
            await loadData();
            toast.success("Travel window updated successfully");
          }}
          onTravelWindowDelete={async () => {
            await loadData();
            toast.success("Travel window deleted successfully");
          }}
          onClose={() => setShowAdminPanel(false)}
        />
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="bg-white rounded-lg p-6">
            <p className="text-gray-900">Loading data...</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && !isLoading && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-[10000]">
          <p className="font-semibold">Error loading data</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}