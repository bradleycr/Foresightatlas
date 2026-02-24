/**
 * Filters Bar
 *
 * Persistent search bar with a collapsible filter flyout.
 * Designed to stay out of the way until needed, then present
 * all filter dimensions in a clean, organised panel.
 */

import { useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
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
    let newReferenceDate = filters.referenceDate;

    if (granularity === "Month" || granularity === "Week") {
      const refDate = new Date(filters.referenceDate);
      if (filters.year !== null) {
        refDate.setFullYear(filters.year);
        refDate.setMonth(0, 1);
        newReferenceDate = refDate.toISOString();
      } else {
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

  const activeCount = [
    filters.programs.length,
    filters.focusTags.length,
    filters.nodes.length,
    filters.cities.length,
    filters.showAlumni === false ? 1 : 0,
    filters.year !== defaultYear ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="border-b border-gray-100 bg-white relative">
      <div className="px-4 md:px-8 py-3 md:py-3.5">
        {/* Search + toggle row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 h-4 w-4 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by name, project, or city..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-9 pr-4 py-2 text-sm h-9 bg-gray-50/60 border-gray-200/70 focus:bg-white"
            />
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`relative inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-colors ${
              isCollapsed
                ? "border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                : "border-gray-300 text-gray-800 bg-gray-50"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold rounded-full bg-teal-500 text-white px-1">
                {activeCount}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border border-gray-200 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Flyout panel ──────────────────────────────────── */}
      {!isCollapsed && (
        <div
          className="absolute left-3 right-3 md:left-8 md:right-8 top-full mt-1.5 bg-white rounded-xl border border-gray-200/60 shadow-xl"
          style={{
            zIndex: Z_INDEX_MODAL_CONTENT,
            boxShadow: '0 16px 32px -8px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div className="px-5 md:px-8 pt-5 pb-6 max-h-[70vh] overflow-y-auto space-y-5">
            {/* People toggle */}
            <FilterSection label="People">
              <FilterBadge
                active={filters.showAlumni}
                onClick={handleAlumniToggle}
                activeGradient={activeToggleGradient}
              >
                Show alumni
              </FilterBadge>
            </FilterSection>

            {/* Programs */}
            <FilterSection label="Programs">
              {PROGRAMS.map((program) => (
                <FilterBadge
                  key={program}
                  active={filters.programs.includes(program)}
                  onClick={() => toggleProgram(program)}
                  activeGradient={getRoleGradient(program)}
                >
                  {program}
                </FilterBadge>
              ))}
            </FilterSection>

            {/* Focus Areas */}
            <FilterSection label="Focus Areas">
              {FOCUS_AREAS.map((tag) => (
                <FilterBadge
                  key={tag}
                  active={filters.focusTags.includes(tag)}
                  onClick={() => toggleFocusTag(tag)}
                  activeGradient={activeBadgeGradient}
                >
                  {tag}
                </FilterBadge>
              ))}
            </FilterSection>

            {/* Nodes */}
            <FilterSection label="Nodes">
              {NODES.map((node) => (
                <FilterBadge
                  key={node}
                  active={filters.nodes.includes(node)}
                  onClick={() => toggleNode(node)}
                  activeGradient={gradientVariant1}
                >
                  {getNodeLabel(node)}
                </FilterBadge>
              ))}
            </FilterSection>

            {/* Cities */}
            {availableCities.length > 0 && (
              <FilterSection label="Cities">
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {availableCities.map((city) => (
                    <FilterBadge
                      key={city}
                      active={filters.cities.includes(city)}
                      onClick={() => toggleCity(city)}
                      activeGradient={activeBadgeGradient}
                    >
                      {city}
                    </FilterBadge>
                  ))}
                </div>
              </FilterSection>
            )}

            {/* Year */}
            <FilterSection label="Year">
              <FilterBadge
                active={filters.year === null}
                onClick={() => handleYearChange(null)}
                activeGradient={activeToggleGradient}
              >
                All Time
              </FilterBadge>
              {years.map((year) => (
                <FilterBadge
                  key={year}
                  active={filters.year === year}
                  onClick={() => handleYearChange(year)}
                  activeGradient={activeToggleGradient}
                >
                  {year}
                </FilterBadge>
              ))}
            </FilterSection>

            {/* Granularity */}
            <FilterSection label="View Granularity">
              {(["Year", "Month", "Week"] as Granularity[]).map((granularity) => (
                <FilterBadge
                  key={granularity}
                  active={filters.granularity === granularity}
                  onClick={() => handleGranularityChange(granularity)}
                  activeGradient={activeToggleGradient}
                >
                  {granularity}
                </FilterBadge>
              ))}
            </FilterSection>

            {/* Reference Date */}
            {(filters.granularity === "Month" || filters.granularity === "Week") && (
              <FilterSection label={filters.granularity === "Month" ? "Select Month" : "Select Week"}>
                <Input
                  type="date"
                  value={filters.referenceDate.split("T")[0]}
                  onChange={(e) => {
                    const selectedDate = new Date(e.target.value + "T00:00:00.000Z");
                    if (filters.year !== null) {
                      selectedDate.setFullYear(filters.year);
                    }
                    handleReferenceDateChange(selectedDate.toISOString());
                  }}
                  className="max-w-xs h-8 text-xs"
                />
                {filters.year !== null && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Showing {filters.granularity.toLowerCase()} from {filters.year}
                  </p>
                )}
              </FilterSection>
            )}

            {/* Timeline View Mode */}
            {activeTab === "timeline" && (
              <FilterSection label="Timeline View Mode">
                {(["person", "location"] as TimelineViewMode[]).map((mode) => (
                  <FilterBadge
                    key={mode}
                    active={filters.timelineViewMode === mode}
                    onClick={() => handleTimelineViewModeChange(mode)}
                    activeGradient={activeToggleGradient}
                  >
                    <span className="capitalize">{mode}</span>
                  </FilterBadge>
                ))}
              </FilterSection>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tiny sub-components ─────────────────────────────────────────────── */

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterBadge({
  active,
  onClick,
  activeGradient,
  children,
}: {
  active: boolean;
  onClick: () => void;
  activeGradient: string;
  children: React.ReactNode;
}) {
  return (
    <Badge
      onClick={onClick}
      className={`cursor-pointer transition-all text-xs ${
        active
          ? "text-gray-800 shadow-sm border-white/50"
          : "text-gray-500 hover:text-gray-700 border-gray-200/80 hover:border-gray-300"
      }`}
      style={
        active
          ? {
              background: activeGradient,
              border: "1px solid rgba(255, 255, 255, 0.5)",
            }
          : undefined
      }
    >
      {children}
    </Badge>
  );
}
