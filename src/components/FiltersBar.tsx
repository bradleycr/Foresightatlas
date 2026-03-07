/**
 * FiltersBar — collapsible search + filter overlay
 *
 * Sits at the top of the page, always shows a search bar,
 * and expands to reveal Programs, Focus Areas, Nodes, Year, and Granularity.
 *
 * Intentionally lean: no alumni toggle (year selection implicitly includes
 * alumni for older cohorts) and no exhaustive city list (search covers cities).
 */

import React, { useState } from "react";
import { Search, X, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { Filters, RoleType, PrimaryNode, Granularity, TimelineViewMode } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { getRoleGradient } from "../styles/roleColors";
import { activeMultiGradient, badgeGradient, gradientVariant1 } from "../styles/gradients";
import { Z_INDEX_MODAL_CONTENT } from "../constants/zIndex";
import { getNodeLabel } from "../utils/nodeLabels";
import { PRESET_FOCUS_AREAS } from "../data/focusAreas";

interface FiltersBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  availableCities: string[];
  defaultYear: number;
  activeTab: "map" | "timeline";
}

const FOCUS_AREAS = [...PRESET_FOCUS_AREAS];

const PROGRAMS: RoleType[] = ["Fellow", "Senior Fellow", "Grantee", "Prize Winner", "Nodee"];
const NODES: PrimaryNode[] = ["Global", "Berlin Node", "Bay Area Node"];

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

  const toggleProgram = (program: RoleType) => {
    const next = filters.programs.includes(program)
      ? filters.programs.filter((p) => p !== program)
      : [...filters.programs, program];
    onFiltersChange({ ...filters, programs: next });
  };

  const toggleFocusTag = (tag: string) => {
    const next = filters.focusTags.includes(tag)
      ? filters.focusTags.filter((t) => t !== tag)
      : [...filters.focusTags, tag];
    onFiltersChange({ ...filters, focusTags: next });
  };

  const toggleNode = (node: PrimaryNode) => {
    const next = filters.nodes.includes(node)
      ? filters.nodes.filter((n) => n !== node)
      : [...filters.nodes, node];
    onFiltersChange({ ...filters, nodes: next });
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
      communityFilter: "all",
      year: null,
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
    filters.communityFilter !== "all" ||
    filters.year !== null;

  // Count active non-search filters for badge
  const activeFilterCount =
    filters.programs.length +
    filters.focusTags.length +
    filters.nodes.length +
    filters.cities.length +
    (filters.year !== null ? 1 : 0) +
    (filters.communityFilter !== "all" ? 1 : 0);

  return (
    <div className="border-b border-gray-200 bg-white relative">
      <div className="px-4 md:px-8 pt-4 md:pt-5 pb-3 md:pb-4">
        {/* Search + filter toggle */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search…"
              title="Search by name, project, or city"
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-10 pr-4 py-2 text-sm md:text-base"
            />
          </div>
          <Button
            onClick={() => setIsCollapsed(!isCollapsed)}
            variant="outline"
            size="sm"
            className="min-h-[44px] touch-manipulation border-gray-300 text-gray-700 hover:bg-gray-50 relative sm:min-h-9"
          >
            {isCollapsed ? (
              <>
                <SlidersHorizontal className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Filters</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Hide</span>
              </>
            )}
            {activeFilterCount > 0 && isCollapsed && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-teal-500 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
            {hasActiveFilters && (
            <Button onClick={clearAllFilters} variant="outline" size="sm" className="min-h-[44px] touch-manipulation border-gray-300 text-gray-700 hover:bg-gray-50 sm:min-h-9">
              <X className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>
      </div>

      {/* Collapsible filter overlay */}
      {!isCollapsed && (
        <div
          className="absolute left-4 right-4 md:left-8 md:right-8 top-full mt-2 bg-white rounded-xl border border-gray-200/50 shadow-2xl"
          style={{ zIndex: Z_INDEX_MODAL_CONTENT, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)" }}
        >
          <div className="px-4 md:px-8 pt-5 pb-6 md:pb-8 max-h-[70vh] overflow-y-auto space-y-5">
            {/* Programs */}
            <FilterSection label="Programs">
              {PROGRAMS.map((p) => (
                <ToggleBadge key={p} active={filters.programs.includes(p)} activeStyle={{ background: getRoleGradient(p), border: "1px solid rgba(255,255,255,0.5)" }} onClick={() => toggleProgram(p)}>
                  {p}
                </ToggleBadge>
              ))}
            </FilterSection>

            {/* Focus Areas */}
            <FilterSection label="Focus Areas">
              {FOCUS_AREAS.map((tag) => (
                <ToggleBadge key={tag} active={filters.focusTags.includes(tag)} activeStyle={{ background: activeBadgeGradient, border: "1px solid rgba(255,255,255,0.5)" }} onClick={() => toggleFocusTag(tag)}>
                  {tag}
                </ToggleBadge>
              ))}
            </FilterSection>

            {/* Nodes */}
            <FilterSection label="Nodes">
              {NODES.map((node) => (
                <ToggleBadge key={node} active={filters.nodes.includes(node)} activeStyle={{ background: gradientVariant1, border: "1px solid rgba(255,255,255,0.5)" }} onClick={() => toggleNode(node)}>
                  {getNodeLabel(node)}
                </ToggleBadge>
              ))}
            </FilterSection>

            {/* Community: current / alumni / all */}
            <FilterSection label="Community">
              <ToggleBadge active={filters.communityFilter === "all"} activeStyle={{ background: activeToggleGradient, border: "1px solid rgba(255,255,255,0.5)" }} onClick={() => onFiltersChange({ ...filters, communityFilter: "all" })}>
                All
              </ToggleBadge>
              <ToggleBadge active={filters.communityFilter === "current"} activeStyle={{ background: activeToggleGradient, border: "1px solid rgba(255,255,255,0.5)" }} onClick={() => onFiltersChange({ ...filters, communityFilter: "current" })}>
                Current only
              </ToggleBadge>
              <ToggleBadge active={filters.communityFilter === "alumni"} activeStyle={{ background: activeToggleGradient, border: "1px solid rgba(255,255,255,0.5)" }} onClick={() => onFiltersChange({ ...filters, communityFilter: "alumni" })}>
                Alumni only
              </ToggleBadge>
            </FilterSection>

            {/* Year */}
            <FilterSection label="Active in year">
              <ToggleBadge active={filters.year === null} activeStyle={{ background: activeToggleGradient, border: "1px solid rgba(255,255,255,0.5)" }} onClick={() => handleYearChange(null)}>
                Any year
              </ToggleBadge>
              {years.map((y) => (
                <ToggleBadge key={y} active={filters.year === y} activeStyle={{ background: activeToggleGradient, border: "1px solid rgba(255,255,255,0.5)" }} onClick={() => handleYearChange(y)}>
                  {y}
                </ToggleBadge>
              ))}
            </FilterSection>

            {/* Granularity */}
            <FilterSection label="View Granularity">
              {(["Year", "Month", "Week"] as Granularity[]).map((g) => (
                <ToggleBadge key={g} active={filters.granularity === g} activeStyle={{ background: activeToggleGradient, border: "1px solid rgba(255,255,255,0.5)" }} onClick={() => handleGranularityChange(g)}>
                  {g}
                </ToggleBadge>
              ))}
            </FilterSection>

            {/* Reference date for Month/Week */}
            {(filters.granularity === "Month" || filters.granularity === "Week") && (
              <div>
                <label className="text-xs md:text-sm font-medium text-gray-700 mb-2.5 block">
                  {filters.granularity === "Month" ? "Select Month" : "Select Week"}
                </label>
                <Input
                  type="date"
                  value={filters.referenceDate.split("T")[0]}
                  onChange={(e) => {
                    const d = new Date(e.target.value + "T00:00:00.000Z");
                    if (filters.year !== null) d.setFullYear(filters.year);
                    handleReferenceDateChange(d.toISOString());
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

            {/* Timeline view mode */}
            {activeTab === "timeline" && (
              <FilterSection label="Timeline View Mode">
                {(["person", "location"] as TimelineViewMode[]).map((m) => (
                  <ToggleBadge key={m} active={filters.timelineViewMode === m} activeStyle={{ background: activeToggleGradient, border: "1px solid rgba(255,255,255,0.5)" }} onClick={() => handleTimelineViewModeChange(m)}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </ToggleBadge>
                ))}
              </FilterSection>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────── */

const FilterSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="text-xs md:text-sm font-medium text-gray-700 mb-2.5 block">{label}</label>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

const ToggleBadge: React.FC<{
  active: boolean;
  activeStyle: React.CSSProperties;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, activeStyle, onClick, children }) => (
  <Badge
    variant={active ? "default" : "outline"}
    onClick={onClick}
    className={`cursor-pointer transition-all ${active ? "text-gray-900 shadow-sm border-white/50" : "bg-neutral-100 border-neutral-200 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 hover:border-neutral-300"}`}
    style={active ? activeStyle : undefined}
  >
    {children}
  </Badge>
);
