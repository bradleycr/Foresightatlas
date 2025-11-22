import { useState } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { Filters, RoleType, PrimaryNode, Granularity, TimelineViewMode } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { getRoleGradient } from "../styles/roleColors";
import { activeMultiGradient, badgeGradient, gradientVariant1 } from "../styles/gradients";

interface FiltersBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onReset: () => void;
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

export function FiltersBar({ filters, onFiltersChange, onReset, availableCities, activeTab }: FiltersBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const today = new Date();
  const currentYear = today.getFullYear();
  // Only show years up to next year (currentYear + 1) to avoid showing future years without data
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const activeBadgeGradient = badgeGradient;
  const activeToggleGradient = activeMultiGradient;
  
  // Check if "Current 12 months" button should be active
  // It's active when: current year, Year granularity, no city filters, and reference date is today
  const isCurrent12MonthsActive = 
    filters.year === currentYear &&
    filters.granularity === "Year" &&
    filters.cities.length === 0 &&
    new Date(filters.referenceDate).toDateString() === today.toDateString();

  const toggleProgram = (program: RoleType) => {
    const newPrograms = filters.programs.includes(program)
      ? filters.programs.filter((p) => p !== program)
      : [...filters.programs, program];
    onFiltersChange({ ...filters, programs: newPrograms });
  };

  const toggleFocus = (focus: string) => {
    const newFocusTags = filters.focusTags.includes(focus)
      ? filters.focusTags.filter((f) => f !== focus)
      : [...filters.focusTags, focus];
    onFiltersChange({ ...filters, focusTags: newFocusTags });
  };

  const toggleNode = (node: PrimaryNode) => {
    // For timeline view: single-select only (one node at a time)
    // For map view: multi-select (allow multiple nodes)
    if (activeTab === "timeline") {
      // If clicking the same node, deselect it; otherwise, select only this node
      const newNodes = filters.nodes.includes(node)
        ? []
        : [node];
      onFiltersChange({ ...filters, nodes: newNodes });
    } else {
      // Map view: allow multiple selections (current behavior)
      const newNodes = filters.nodes.includes(node)
        ? filters.nodes.filter((n) => n !== node)
        : [...filters.nodes, node];
      onFiltersChange({ ...filters, nodes: newNodes });
    }
  };

  const toggleCity = (city: string) => {
    // For timeline view: single-select only (one city at a time)
    // For map view: multi-select (allow multiple cities)
    if (activeTab === "timeline") {
      // If clicking the same city, deselect it; otherwise, select only this city
      const newCities = filters.cities.includes(city)
        ? []
        : [city];
      onFiltersChange({ ...filters, cities: newCities });
    } else {
      // Map view: allow multiple selections (current behavior)
      const newCities = filters.cities.includes(city)
        ? filters.cities.filter((c) => c !== city)
        : [...filters.cities, city];
      onFiltersChange({ ...filters, cities: newCities });
    }
  };

  return (
    <div 
      className="border-b border-gray-200 px-4 md:px-6 py-4 space-y-4"
      style={{
        background: 'linear-gradient(to bottom, #ffffff 0%, #fafafa 100%)'
      }}
    >
      {/* Search and Year/Granularity Controls */}
      <div className="flex gap-2 md:gap-4 items-center flex-wrap">
        <div className="flex-1 min-w-[200px] sm:min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by name, project, or city"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-10 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Year:</label>
          <select
            value={filters.year === null ? "all" : filters.year}
            onChange={(e) => {
              const value = e.target.value;
              onFiltersChange({ 
                ...filters, 
                year: value === "all" ? null : parseInt(value) 
              });
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="all">All time</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">View:</label>
          <div className="flex gap-1 bg-white/70 border border-gray-200 rounded-full p-1 shadow-inner">
            {(["Year", "Month", "Week"] as Granularity[]).map((gran) => (
              <button
                key={gran}
                onClick={() => onFiltersChange({ ...filters, granularity: gran })}
                className={`px-3 py-1.5 text-sm rounded-full transition-all border ${
                  filters.granularity === gran
                    ? "text-gray-900 shadow-md border-transparent"
                    : "text-gray-600 hover:text-gray-900 border-transparent"
                }`}
                style={
                  filters.granularity === gran
                    ? { background: activeToggleGradient }
                    : undefined
                }
                aria-pressed={filters.granularity === gran}
              >
                {gran}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline View Mode Toggle - only show on timeline tab */}
        {activeTab === "timeline" && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Organize by:</label>
            <div className="flex gap-1 bg-white/70 border border-gray-200 rounded-full p-1 shadow-inner">
              {(["person", "location"] as TimelineViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onFiltersChange({ ...filters, timelineViewMode: mode })}
                  className={`px-3 py-1.5 text-sm rounded-full transition-all border capitalize ${
                    filters.timelineViewMode === mode
                      ? "text-gray-900 shadow-md border-transparent"
                      : "text-gray-600 hover:text-gray-900 border-transparent"
                  }`}
                  style={
                    filters.timelineViewMode === mode
                      ? { background: activeToggleGradient }
                      : undefined
                  }
                  aria-pressed={filters.timelineViewMode === mode}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reference date control for Month/Week views */}
        {filters.granularity !== "Year" && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">
              {filters.granularity === "Month" ? "Month:" : "Week of:"}
            </label>
            {filters.granularity === "Month" ? (
              <select
                value={new Date(filters.referenceDate).getMonth()}
                onChange={(e) => {
                  const selectedMonth = parseInt(e.target.value);
                  const currentYear = filters.year || new Date().getFullYear();
                  // Set to the first day of the selected month
                  const newDate = new Date(currentYear, selectedMonth, 1);
                  onFiltersChange({
                    ...filters,
                    referenceDate: newDate.toISOString(),
                  });
                }}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date(2000, i, 1); // Use year 2000 as base for month names
                  const monthName = date.toLocaleDateString("en-US", { month: "short" });
                  return (
                    <option key={i} value={i}>
                      {monthName}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="date"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
                value={filters.referenceDate.slice(0, 10)}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    referenceDate: new Date(e.target.value).toISOString(),
                  })
                }
              />
            )}
          </div>
        )}

        <Button 
          onClick={onReset} 
          variant="outline" 
          size="sm"
          className={`transition-all ${
            isCurrent12MonthsActive
              ? "text-gray-900 shadow-md border-transparent"
              : "text-gray-600 hover:text-gray-900"
          }`}
          style={
            isCurrent12MonthsActive
              ? { background: gradientVariant1 }
              : undefined
          }
        >
          Current 12 months
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="text-gray-600 hover:text-gray-900"
        >
          {isCollapsed ? (
            <>
              Show filters <ChevronDown className="size-4 ml-1" />
            </>
          ) : (
            <>
              Hide filters <ChevronUp className="size-4 ml-1" />
            </>
          )}
        </Button>
      </div>

      {/* Filter Pills */}
      {!isCollapsed && (
      <div className="space-y-3">
        {/* Programs */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 min-w-[80px]">Program:</span>
          {PROGRAMS.map((program) => (
            <Badge
              key={program}
              variant={filters.programs.includes(program) ? "default" : "outline"}
              className={`cursor-pointer border transition-all ${
                filters.programs.includes(program)
                  ? "text-gray-900 border-transparent shadow-sm"
                  : "hover:bg-gray-100 text-gray-600 border-gray-200"
              }`}
              style={
                filters.programs.includes(program)
                  ? { background: getRoleGradient(program) }
                  : undefined
              }
              onClick={() => toggleProgram(program)}
            >
              {program}
              {filters.programs.includes(program) && (
                <X className="ml-1 size-3" />
              )}
            </Badge>
          ))}
        </div>

        {/* Focus Areas */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 min-w-[80px]">Focus:</span>
          {FOCUS_AREAS.map((focus) => (
            <Badge
              key={focus}
              variant={filters.focusTags.includes(focus) ? "default" : "outline"}
              className={`cursor-pointer border transition-all ${
                filters.focusTags.includes(focus)
                  ? "text-gray-900 border-transparent shadow-sm"
                  : "hover:bg-gray-100 text-gray-600 border-gray-200"
              }`}
              style={
                filters.focusTags.includes(focus)
                  ? { background: activeBadgeGradient }
                  : undefined
              }
              onClick={() => toggleFocus(focus)}
            >
              {focus}
              {filters.focusTags.includes(focus) && <X className="ml-1 size-3" />}
            </Badge>
          ))}
        </div>

        {/* Nodes */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 min-w-[80px]">Node:</span>
          {NODES.map((node) => (
            <Badge
              key={node}
              variant={filters.nodes.includes(node) ? "default" : "outline"}
              className={`cursor-pointer border transition-all ${
                filters.nodes.includes(node)
                  ? "text-gray-900 border-transparent shadow-sm"
                  : "hover:bg-gray-100 text-gray-600 border-gray-200"
              }`}
              style={
                filters.nodes.includes(node)
                  ? { background: activeBadgeGradient }
                  : undefined
              }
              onClick={() => toggleNode(node)}
            >
              {node}
              {filters.nodes.includes(node) && <X className="ml-1 size-3" />}
            </Badge>
          ))}
        </div>

        {/* Cities */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 min-w-[80px]">City:</span>
          {availableCities.length > 0 ? (
            availableCities.map((city) => (
              <Badge
                key={city}
                variant={filters.cities.includes(city) ? "default" : "outline"}
                className={`cursor-pointer border transition-all ${
                  filters.cities.includes(city)
                    ? "text-gray-900 border-transparent shadow-sm"
                    : "hover:bg-gray-100 text-gray-600 border-gray-200"
                }`}
                style={
                  filters.cities.includes(city)
                    ? { background: activeBadgeGradient }
                    : undefined
                }
                onClick={() => toggleCity(city)}
              >
                {city}
                {filters.cities.includes(city) && <X className="ml-1 size-3" />}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-gray-500">No cities available</span>
          )}
        </div>
      </div>
      )}
    </div>
  );
}