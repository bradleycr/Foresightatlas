import { useState } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { Filters, RoleType, PrimaryNode, Granularity, TimelineViewMode } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { getRoleGradient } from "../styles/roleColors";
import { activeMultiGradient, badgeGradient, gradientVariant1 } from "../styles/gradients";
import { Z_INDEX_MODAL_CONTENT } from "../constants/zIndex";
import { getNodeLabel } from "../utils/nodeLabels";

interface FiltersBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  availableCities: string[];
  defaultYear: number;
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
const NODES: PrimaryNode[] = ["Global", "Berlin Node", "Bay Area Node", "Alumni"];

export function FiltersBar({
  filters,
  onFiltersChange,
  availableCities,
  defaultYear,
  activeTab,
}: FiltersBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const today = new Date();
  const currentYear = today.getFullYear();
  // Show all years from 2017 (first fellowship cohort) to next year
  const years = Array.from({ length: currentYear + 2 - 2017 }, (_, i) => 2017 + i);
  const activeBadgeGradient = badgeGradient;
  const activeToggleGradient = activeMultiGradient;
  const handleAlumniToggle = () => {
    onFiltersChange({ ...filters, showAlumni: !filters.showAlumni });
  };

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
      showAlumni: true,
      year: defaultYear,
      granularity: "Year",
      referenceDate: new Date().toISOString(),
    });
  };

  const hasActiveFilters =
    filters.search !== "" ||
    filters.programs.length > 0 ||
    filters.focusTags.length > 0 ||
    filters.nodes.length > 0 ||
    filters.cities.length > 0 ||
    filters.showAlumni === false ||
    filters.year !== defaultYear;
  const selectedFiltersCount =
    (filters.search ? 1 : 0) +
    filters.programs.length +
    filters.focusTags.length +
    filters.nodes.length +
    filters.cities.length +
    (filters.showAlumni ? 0 : 1) +
    (filters.year !== defaultYear ? 1 : 0);
  const getFilterChipClass = (isActive: boolean) =>
    `filter-chip ${isActive ? "filter-chip--active" : ""}`;
  const getFilterChipStyle = (isActive: boolean, activeBackground: string) =>
    isActive ? { background: activeBackground } : undefined;

  return (
    <div className="border-b border-gray-200 bg-white relative backdrop-blur-sm">
      <div className="px-4 md:px-8 pt-4 md:pt-5 pb-4 md:pb-5">
        <div className="filters-shell">
          <div className="flex items-center gap-2 md:gap-3">
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="filters-summary-pill">
              {selectedFiltersCount > 0
                ? `${selectedFiltersCount} active filter${selectedFiltersCount === 1 ? "" : "s"}`
                : "No active filters"}
            </span>
            <span className="filters-summary-pill">
              {filters.year === null ? "All Time" : filters.year} • {filters.granularity}
            </span>
            {filters.search && (
              <span className="filters-summary-pill">Query: "{filters.search}"</span>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Filters - Overlay */}
      {!isCollapsed && (
        <div 
          className="filters-popover absolute left-4 right-4 md:left-8 md:right-8 top-full mt-2"
          style={{ zIndex: Z_INDEX_MODAL_CONTENT }}
        >
          <div className="px-4 md:px-8 pt-5 pb-6 md:pb-8 max-h-[70vh] overflow-y-auto">
            <div className="space-y-5">
            {/* People: include alumni (toggle off to hide) */}
            <div>
              <label className="filter-group-label">
                People
              </label>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  onClick={handleAlumniToggle}
                  className={getFilterChipClass(filters.showAlumni)}
                  style={getFilterChipStyle(filters.showAlumni, activeToggleGradient)}
                >
                  Show alumni
                </Badge>
              </div>
            </div>

            {/* Programs Filter */}
            <div>
              <label className="filter-group-label">
                Programs
              </label>
              <div className="flex flex-wrap gap-2">
                {PROGRAMS.map((program) => {
                  const isActive = filters.programs.includes(program);
                  return (
                    <Badge
                      variant="outline"
                      key={program}
                      onClick={() => toggleProgram(program)}
                      className={getFilterChipClass(isActive)}
                      style={getFilterChipStyle(isActive, getRoleGradient(program))}
                    >
                      {program}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Focus Areas Filter */}
            <div>
              <label className="filter-group-label">
                Focus Areas
              </label>
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREAS.map((tag) => {
                  const isActive = filters.focusTags.includes(tag);
                  return (
                    <Badge
                      variant="outline"
                      key={tag}
                      onClick={() => toggleFocusTag(tag)}
                      className={getFilterChipClass(isActive)}
                      style={getFilterChipStyle(isActive, activeBadgeGradient)}
                    >
                      {tag}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Nodes Filter */}
            <div>
              <label className="filter-group-label">
                Nodes
              </label>
              <div className="flex flex-wrap gap-2">
                {NODES.map((node) => {
                  const isActive = filters.nodes.includes(node);
                  return (
                    <Badge
                      variant="outline"
                      key={node}
                      onClick={() => toggleNode(node)}
                      className={getFilterChipClass(isActive)}
                      style={getFilterChipStyle(isActive, gradientVariant1)}
                    >
                      {getNodeLabel(node)}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Cities Filter */}
            {availableCities.length > 0 && (
              <div>
                <label className="filter-group-label">
                  Cities
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {availableCities.map((city) => {
                    const isActive = filters.cities.includes(city);
                    return (
                      <Badge
                        variant="outline"
                        key={city}
                        onClick={() => toggleCity(city)}
                        className={getFilterChipClass(isActive)}
                        style={getFilterChipStyle(isActive, activeBadgeGradient)}
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
              <label className="filter-group-label">
                Year
              </label>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  onClick={() => handleYearChange(null)}
                  className={getFilterChipClass(filters.year === null)}
                  style={getFilterChipStyle(filters.year === null, activeToggleGradient)}
                >
                  All Time
                </Badge>
                {years.map((year) => {
                  const isActive = filters.year === year;
                  return (
                    <Badge
                      variant="outline"
                      key={year}
                      onClick={() => handleYearChange(year)}
                      className={getFilterChipClass(isActive)}
                      style={getFilterChipStyle(isActive, activeToggleGradient)}
                    >
                      {year}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="filter-group-label">
                View Granularity
              </label>
              <div className="flex flex-wrap gap-2">
                {(["Year", "Month", "Week"] as Granularity[]).map((granularity) => {
                  const isActive = filters.granularity === granularity;
                  return (
                    <Badge
                      variant="outline"
                      key={granularity}
                      onClick={() => handleGranularityChange(granularity)}
                      className={getFilterChipClass(isActive)}
                      style={getFilterChipStyle(isActive, activeToggleGradient)}
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
                <label className="filter-group-label">
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
                <label className="filter-group-label">
                  Timeline View Mode
                </label>
                <div className="flex flex-wrap gap-2">
                  {(["person", "location"] as TimelineViewMode[]).map((mode) => {
                    const isActive = filters.timelineViewMode === mode;
                    return (
                      <Badge
                        variant="outline"
                        key={mode}
                        onClick={() => handleTimelineViewModeChange(mode)}
                        className={`${getFilterChipClass(isActive)} capitalize`}
                        style={getFilterChipStyle(isActive, activeToggleGradient)}
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


