import { useState } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { Filters, RoleType, PrimaryNode, Granularity, TimelineViewMode } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { getRoleGradient } from "../styles/roleColors";
import { activeMultiGradient, badgeGradient, gradientVariant1 } from "../styles/gradients";
import { Z_INDEX_DROPDOWN } from "../constants/zIndex";

interface FiltersBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  availableCities: string[];
  activeTab: "map" | "timeline";
}

const FOCUS_AREAS = [
  "Secure AI",
  "Neurotechnology",
  "Longevity Biotechnology",
  "Nanotechnology",
  "Space",
  "Existential Hope",
  "Other",
];

const PROGRAMS: RoleType[] = ["Fellow", "Grantee", "Prize Winner"];
const NODES: PrimaryNode[] = ["Global", "Berlin Node", "Bay Area Node"];

export function FiltersBar({ filters, onFiltersChange, availableCities, activeTab }: FiltersBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const today = new Date();
  const currentYear = today.getFullYear();
  // Only show years up to next year (currentYear + 1) to avoid showing future years without data
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const activeBadgeGradient = badgeGradient;
  const activeToggleGradient = activeMultiGradient;

  const toggleProgram = (program: RoleType) => {
    const newPrograms = filters.programs.includes(program)
      ? filters.programs.filter((p) => p !== program)
      : [...filters.programs, program];
    onFiltersChange({ ...filters, programs: newPrograms });
  };

  const toggleFocusTag = (tag: string) => {
    const newTags = filters.focusTags.includes(tag)
      ? filters.focusTags.filter((t) => t !== tag)
      : [...filters.focusTags, tag];
    onFiltersChange({ ...filters, focusTags: newTags });
  };

  const toggleNode = (node: PrimaryNode) => {
    const newNodes = filters.nodes.includes(node)
      ? filters.nodes.filter((n) => n !== node)
      : [...filters.nodes, node];
    onFiltersChange({ ...filters, nodes: newNodes });
  };

  const toggleCity = (city: string) => {
    const newCities = filters.cities.includes(city)
      ? filters.cities.filter((c) => c !== city)
      : [...filters.cities, city];
    onFiltersChange({ ...filters, cities: newCities });
  };

  const handleYearChange = (year: number | null) => {
    onFiltersChange({ ...filters, year });
  };

  const handleGranularityChange = (granularity: Granularity) => {
    // When switching to Month/Week, ensure reference date is set appropriately
    let newReferenceDate = filters.referenceDate;
    
    if (granularity === "Month" || granularity === "Week") {
      const refDate = new Date(filters.referenceDate);
      // If a year is selected, use that year for the reference date
      if (filters.year !== null) {
        refDate.setFullYear(filters.year);
        // For Month, default to first of the month
        if (granularity === "Month") {
          refDate.setMonth(0, 1); // January 1st of selected year
        }
        // For Week, default to first week of the year
        else if (granularity === "Week") {
          refDate.setMonth(0, 1); // January 1st of selected year
        }
        newReferenceDate = refDate.toISOString();
      }
      // If "All Time" is selected, use today's date
      else {
        newReferenceDate = new Date().toISOString();
      }
    }
    
    onFiltersChange({ ...filters, granularity, referenceDate: newReferenceDate });
  };

  const handleTimelineViewModeChange = (mode: TimelineViewMode) => {
    onFiltersChange({ ...filters, timelineViewMode: mode });
  };

  const handleReferenceDateChange = (date: string) => {
    onFiltersChange({ ...filters, referenceDate: date });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      ...filters,
      search: "",
      programs: [],
      focusTags: [],
      nodes: [],
      cities: [],
      year: null, // Reset to "All Time"
      granularity: "Year", // Reset to Year view
      referenceDate: new Date().toISOString(), // Reset to today
    });
  };

  const hasActiveFilters = 
    filters.search !== "" ||
    filters.programs.length > 0 ||
    filters.focusTags.length > 0 ||
    filters.nodes.length > 0 ||
    filters.cities.length > 0;

  return (
    <div className="border-b border-gray-200 bg-white relative">
      <div className="px-4 md:px-8 pt-4 md:pt-5 pb-3 md:pb-4">
        {/* Search Bar - Always Visible */}
        <div className="flex items-center gap-2 md:gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by name, project, or city..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-10 pr-4 py-2 text-sm md:text-base"
            />
          </div>
          <Button
            onClick={() => setIsCollapsed(!isCollapsed)}
            variant="outline"
            size="sm"
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Filters</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Hide</span>
              </>
            )}
          </Button>
          {hasActiveFilters && (
            <Button
              onClick={clearAllFilters}
              variant="outline"
              size="sm"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <X className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>
      </div>

      {/* Collapsible Filters - Overlay */}
      {!isCollapsed && (
        <div 
          className="absolute left-4 right-4 md:left-8 md:right-8 top-full mt-2 bg-white rounded-xl border border-gray-200/50 shadow-2xl z-50"
          style={{ 
            zIndex: Z_INDEX_DROPDOWN,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div className="px-4 md:px-8 pt-5 pb-6 md:pb-8 max-h-[70vh] overflow-y-auto">
            <div className="space-y-5">
            {/* Programs Filter */}
            <div>
              <label className="text-xs md:text-sm font-medium text-gray-700 mb-2.5 block">
                Programs
              </label>
              <div className="flex flex-wrap gap-2">
                {PROGRAMS.map((program) => {
                  const isActive = filters.programs.includes(program);
                  return (
                    <Badge
                      key={program}
                      onClick={() => toggleProgram(program)}
                      className={`cursor-pointer transition-all ${
                        isActive
                          ? "text-gray-900 shadow-sm border-white/50"
                          : "text-gray-600 hover:text-gray-900 border-gray-200"
                      }`}
                      style={
                        isActive
                          ? {
                              background: getRoleGradient(program),
                              border: "1px solid rgba(255, 255, 255, 0.5)",
                            }
                          : undefined
                      }
                    >
                      {program}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Focus Areas Filter */}
            <div>
              <label className="text-xs md:text-sm font-medium text-gray-700 mb-2.5 block">
                Focus Areas
              </label>
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREAS.map((tag) => {
                  const isActive = filters.focusTags.includes(tag);
                  return (
                    <Badge
                      key={tag}
                      onClick={() => toggleFocusTag(tag)}
                      className={`cursor-pointer transition-all ${
                        isActive
                          ? "text-gray-900 shadow-sm border-white/50"
                          : "text-gray-600 hover:text-gray-900 border-gray-200"
                      }`}
                      style={
                        isActive
                          ? {
                              background: activeBadgeGradient,
                              border: "1px solid rgba(255, 255, 255, 0.5)",
                            }
                          : undefined
                      }
                    >
                      {tag}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Nodes Filter */}
            <div>
              <label className="text-xs md:text-sm font-medium text-gray-700 mb-2.5 block">
                Nodes
              </label>
              <div className="flex flex-wrap gap-2">
                {NODES.map((node) => {
                  const isActive = filters.nodes.includes(node);
                  return (
                    <Badge
                      key={node}
                      onClick={() => toggleNode(node)}
                      className={`cursor-pointer transition-all ${
                        isActive
                          ? "text-gray-900 shadow-sm border-white/50"
                          : "text-gray-600 hover:text-gray-900 border-gray-200"
                      }`}
                      style={
                        isActive
                          ? {
                              background: gradientVariant1,
                              border: "1px solid rgba(255, 255, 255, 0.5)",
                            }
                          : undefined
                      }
                    >
                      {node}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Cities Filter */}
            {availableCities.length > 0 && (
              <div>
                <label className="text-xs md:text-sm font-medium text-gray-700 mb-2.5 block">
                  Cities
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {availableCities.map((city) => {
                    const isActive = filters.cities.includes(city);
                    return (
                      <Badge
                        key={city}
                        onClick={() => toggleCity(city)}
                        className={`cursor-pointer transition-all ${
                          isActive
                            ? "text-gray-900 shadow-sm border-white/50"
                            : "text-gray-600 hover:text-gray-900 border-gray-200"
                        }`}
                        style={
                          isActive
                            ? {
                                background: activeBadgeGradient,
                                border: "1px solid rgba(255, 255, 255, 0.5)",
                              }
                            : undefined
                        }
                      >
                        {city}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Year and Granularity - Available for both Map and Timeline */}
            <div>
              <label className="text-xs md:text-sm font-medium text-gray-700 mb-2.5 block">
                Year
              </label>
              <div className="flex flex-wrap gap-2">
                <Badge
                  onClick={() => handleYearChange(null)}
                  className={`cursor-pointer transition-all ${
                    filters.year === null
                      ? "text-gray-900 shadow-sm border-white/50"
                      : "text-gray-600 hover:text-gray-900 border-gray-200"
                  }`}
                  style={
                    filters.year === null
                      ? {
                          background: activeToggleGradient,
                          border: "1px solid rgba(255, 255, 255, 0.5)",
                        }
                      : undefined
                  }
                >
                  All Time
                </Badge>
                {years.map((year) => {
                  const isActive = filters.year === year;
                  return (
                    <Badge
                      key={year}
                      onClick={() => handleYearChange(year)}
                      className={`cursor-pointer transition-all ${
                        isActive
                          ? "text-gray-900 shadow-sm border-white/50"
                          : "text-gray-600 hover:text-gray-900 border-gray-200"
                      }`}
                      style={
                        isActive
                          ? {
                              background: activeToggleGradient,
                              border: "1px solid rgba(255, 255, 255, 0.5)",
                            }
                          : undefined
                      }
                    >
                      {year}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs md:text-sm font-medium text-gray-700 mb-2.5 block">
                View Granularity
              </label>
              <div className="flex flex-wrap gap-2">
                {(["Year", "Month", "Week"] as Granularity[]).map((granularity) => {
                  const isActive = filters.granularity === granularity;
                  return (
                    <Badge
                      key={granularity}
                      onClick={() => handleGranularityChange(granularity)}
                      className={`cursor-pointer transition-all ${
                        isActive
                          ? "text-gray-900 shadow-sm border-white/50"
                          : "text-gray-600 hover:text-gray-900 border-gray-200"
                      }`}
                      style={
                        isActive
                          ? {
                              background: activeToggleGradient,
                              border: "1px solid rgba(255, 255, 255, 0.5)",
                            }
                          : undefined
                      }
                    >
                      {granularity}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Reference Date Input - Only for Month/Week views */}
            {(filters.granularity === "Month" || filters.granularity === "Week") && (
              <div>
                <label className="text-xs md:text-sm font-medium text-gray-700 mb-2.5 block">
                  {filters.granularity === "Month" ? "Select Month" : "Select Week"}
                </label>
                <Input
                  type="date"
                  value={filters.referenceDate.split("T")[0]}
                  onChange={(e) => {
                    const selectedDate = new Date(e.target.value + "T00:00:00.000Z");
                    // If a year is selected, ensure the date stays within that year
                    if (filters.year !== null) {
                      selectedDate.setFullYear(filters.year);
                    }
                    handleReferenceDateChange(selectedDate.toISOString());
                  }}
                  className="max-w-xs"
                />
                {filters.year !== null && (
                  <p className="text-xs text-gray-500 mt-1">
                    Showing {filters.granularity.toLowerCase()} from {filters.year}
                  </p>
                )}
              </div>
            )}

            {/* Timeline View Mode - Only for Timeline */}
            {activeTab === "timeline" && (
              <div>
                <label className="text-xs md:text-sm font-medium text-gray-700 mb-2.5 block">
                  Timeline View Mode
                </label>
                <div className="flex flex-wrap gap-2">
                  {(["person", "location"] as TimelineViewMode[]).map((mode) => {
                    const isActive = filters.timelineViewMode === mode;
                    return (
                      <Badge
                        key={mode}
                        onClick={() => handleTimelineViewModeChange(mode)}
                        className={`cursor-pointer transition-all capitalize ${
                          isActive
                            ? "text-gray-900 shadow-sm border-white/50"
                            : "text-gray-600 hover:text-gray-900 border-gray-200"
                        }`}
                        style={
                          isActive
                            ? {
                                background: activeToggleGradient,
                                border: "1px solid rgba(255, 255, 255, 0.5)",
                              }
                            : undefined
                        }
                      >
                        {mode}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


