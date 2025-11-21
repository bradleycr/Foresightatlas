import { useState, useMemo } from "react";
import { AppHeader } from "./components/AppHeader";
import { FiltersBar } from "./components/FiltersBar";
import { MapView } from "./components/MapView";
import { TimelineView } from "./components/TimelineView";
import { SuggestUpdateModal } from "./components/SuggestUpdateModal";
import { AdminLoginModal } from "./components/AdminLoginModal";
import { AdminPanel } from "./components/AdminPanel";
import { MessageCircle } from "lucide-react";
import { Filters } from "./types";
import {
  getAllPeople,
  getAllTravelWindows,
  addSuggestion,
  updateSuggestionStatus,
  suggestionsStore,
  mockAdminUsers,
} from "./data/mockData";

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

  // Filter state
  const currentYear = new Date().getFullYear();
  const [filters, setFilters] = useState<Filters>({
    search: "",
    programs: [],
    focusTags: [],
    nodes: [],
    year: currentYear,
    granularity: "Year",
  });

  // Data
  const people = getAllPeople();
  const travelWindows = getAllTravelWindows();

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

      return true;
    });
  }, [people, filters]);

  const filteredTravelWindows = useMemo(() => {
    const personIds = new Set(filteredPeople.map((p) => p.id));
    return travelWindows.filter((tw) => personIds.has(tw.personId));
  }, [travelWindows, filteredPeople]);

  // Time window for map view
  const timeWindowStart = useMemo(() => {
    return new Date(filters.year, 0, 1);
  }, [filters.year]);

  const timeWindowEnd = useMemo(() => {
    return new Date(filters.year, 11, 31);
  }, [filters.year]);

  // Handle reset to current 12 months
  const handleResetToCurrent12Months = () => {
    const now = new Date();
    setFilters({
      ...filters,
      year: now.getFullYear(),
      granularity: "Year",
    });
  };

  // Handle admin login
  const handleAdminLogin = (email: string, password: string): boolean => {
    // TODO: Replace with real auth
    // Example: const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    const admin = mockAdminUsers.find(
      (u) => u.email === email && u.passwordPlaceholder === password
    );

    if (admin) {
      setIsAdmin(true);
      setAdminUser(admin);
      setShowAdminLogin(false);
      return true;
    }

    return false;
  };

  // Handle logout
  const handleLogout = () => {
    // TODO: Replace with: await supabase.auth.signOut()
    setIsAdmin(false);
    setAdminUser(null);
  };

  // Handle suggestion submission
  const handleSuggestionSubmit = (suggestion: any) => {
    // TODO: Replace with API call
    // Example: await supabase.from('suggestions').insert(suggestion)
    addSuggestion(suggestion);
    setShowSuggestModal(false);
  };

  // Handle suggestion acceptance
  const handleAcceptSuggestion = (id: string) => {
    // TODO: Replace with API call
    // Example: 
    // 1. await supabase.from('suggestions').update({ status: 'Accepted' }).eq('id', id)
    // 2. Apply the actual changes to person/travel_windows tables
    // 3. Send notification email to submitter

    updateSuggestionStatus(id, "Accepted");

    // In a real app, we'd parse the suggestion and apply changes to the database
    const suggestion = suggestionsStore.find((s) => s.id === id);
    if (suggestion) {
      console.log("Would apply changes from suggestion:", suggestion);
      // This is where you'd call updatePerson() or addTravelWindow() based on the payload
    }
  };

  // Handle suggestion rejection
  const handleRejectSuggestion = (id: string) => {
    // TODO: Replace with API call
    // Example: 
    // await supabase.from('suggestions').update({ status: 'Rejected' }).eq('id', id)
    updateSuggestionStatus(id, "Rejected");
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
      />

      {/* Filters */}
      <FiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        onReset={handleResetToCurrent12Months}
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
            filteredPeople={filteredPeople}
            filteredTravelWindows={filteredTravelWindows}
            year={filters.year}
            granularity={filters.granularity}
          />
        )}
      </div>

      {/* Floating Suggest Button */}
      <button
        onClick={() => setShowSuggestModal(true)}
        className="fixed bottom-6 right-6 text-white rounded-full px-6 py-4 shadow-lg hover:shadow-xl transition-all flex items-center gap-2 z-40 border border-white/20"
        style={{
          background: 'linear-gradient(135deg, #a7f3d0 0%, #a5f3fc 100%)'
        }}
      >
        <MessageCircle className="size-5" />
        <span className="hidden sm:inline">Suggest an update</span>
        <span className="sm:hidden">Update</span>
      </button>

      {/* Modals */}
      {showSuggestModal && (
        <SuggestUpdateModal
          onClose={() => setShowSuggestModal(false)}
          onSubmit={handleSuggestionSubmit}
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
          suggestions={suggestionsStore}
          onAccept={handleAcceptSuggestion}
          onReject={handleRejectSuggestion}
          onClose={() => setShowAdminPanel(false)}
        />
      )}
    </div>
  );
}