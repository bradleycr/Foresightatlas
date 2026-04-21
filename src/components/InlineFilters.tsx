/**
 * InlineFilters — compact filter strip for the sidebar / mobile list sheet
 *
 * Shows a search field plus the most important quick-filters (Programs, Focus,
 * Year) so users can narrow results without leaving the list view.
 * Designed to be slim: a search input + horizontally scrollable badge rows.
 */

import React, { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Filters, RoleType } from "../types";
import { Badge } from "./ui/badge";
import { cn } from "./ui/utils";
import { getRoleGradient } from "../styles/roleColors";
import { activeMultiGradient, badgeGradient } from "../styles/gradients";

interface InlineFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  defaultYear: number;
  resultCount: number;
  /** Controlled expand/collapse of the filter section (e.g. collapse when user selects from map). */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
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

const PROGRAMS: RoleType[] = ["Fellow", "Senior Fellow", "Grantee", "Prize Winner", "Nodee"];

export function InlineFilters({ filters, onFiltersChange, defaultYear, resultCount, expanded: controlledExpanded, onExpandedChange }: InlineFiltersProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;
  const setExpanded = (value: boolean) => {
    if (isControlled) onExpandedChange?.(value);
    else setInternalExpanded(value);
  };
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear + 2 - 2017 }, (_, i) => 2017 + i);
  const activeToggle = activeMultiGradient;
  const activeFocus = badgeGradient;

  const toggleProgram = (p: RoleType) => {
    const next = filters.programs.includes(p) ? filters.programs.filter((x) => x !== p) : [...filters.programs, p];
    onFiltersChange({ ...filters, programs: next });
  };
  const toggleFocusTag = (t: string) => {
    const next = filters.focusTags.includes(t) ? filters.focusTags.filter((x) => x !== t) : [...filters.focusTags, t];
    onFiltersChange({ ...filters, focusTags: next });
  };
  const setYear = (y: number | null) => {
    if (y !== null && y !== currentYear) {
      onFiltersChange({ ...filters, year: y, granularity: "Year" });
    } else {
      onFiltersChange({ ...filters, year: y });
    }
  };

  const activeCount =
    filters.programs.length +
    filters.focusTags.length +
    (filters.year !== null ? 1 : 0) +
    (filters.communityFilter !== "all" ? 1 : 0);

  return (
    <div className="inline-filters space-y-3">
      {/* Search — full-width row so the input has room; short placeholder keeps it feeling spacious */}
      <div className="w-full">
        <label className="sr-only" htmlFor="sidebar-search">
          Search by name, details, or city
        </label>
        <div className="relative">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 size-4 pointer-events-none"
            aria-hidden
          />
          <input
            id="sidebar-search"
            type="search"
            placeholder="Search…"
            title="Search by name, details, or city"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="inline-filters__input w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors focus:border-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-200 min-h-[2.75rem]"
          />
        </div>
      </div>

      {/* Result count + prominent Filters button */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-neutral-500">
          {resultCount} {resultCount === 1 ? "person" : "people"}
        </p>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "inline-filters__toggle relative flex items-center gap-2 rounded-lg border font-medium text-sm transition-all min-h-[2.75rem] sm:min-h-[2.25rem] px-4 py-2 touch-manipulation",
            "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-teal-400",
            expanded || activeCount > 0
              ? "border-teal-300/80 text-gray-900 shadow-sm"
              : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
          )}
          style={expanded || activeCount > 0 ? { background: activeToggle, borderColor: "rgba(255,255,255,0.5)" } : undefined}
          aria-label={expanded ? "Collapse filters" : "Expand filters"}
          aria-expanded={expanded}
        >
          <SlidersHorizontal className="size-4 shrink-0" aria-hidden />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 text-[11px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Expanded quick-filters */}
      {expanded && (
        <div className="space-y-3 pt-1 pb-1">
          {/* Programs */}
          <QuickRow label="Program">
            {PROGRAMS.map((p) => (
              <TogglePill key={p} active={filters.programs.includes(p)} activeStyle={{ background: getRoleGradient(p), border: "1px solid rgba(255,255,255,0.5)" }} onClick={() => toggleProgram(p)}>
                {p}
              </TogglePill>
            ))}
          </QuickRow>

          {/* Focus */}
          <QuickRow label="Focus">
            {FOCUS_AREAS.map((t) => (
              <TogglePill key={t} active={filters.focusTags.includes(t)} activeStyle={{ background: activeFocus, border: "1px solid rgba(255,255,255,0.5)" }} onClick={() => toggleFocusTag(t)}>
                {t}
              </TogglePill>
            ))}
          </QuickRow>

          <QuickRow label="Community">
            <TogglePill
              active={filters.communityFilter === "all"}
              activeStyle={{ background: activeToggle, border: "1px solid rgba(255,255,255,0.5)" }}
              onClick={() => onFiltersChange({ ...filters, communityFilter: "all" })}
            >
              All
            </TogglePill>
            <TogglePill
              active={filters.communityFilter === "current"}
              activeStyle={{ background: activeToggle, border: "1px solid rgba(255,255,255,0.5)" }}
              onClick={() => onFiltersChange({ ...filters, communityFilter: "current" })}
            >
              Current only
            </TogglePill>
            <TogglePill
              active={filters.communityFilter === "alumni"}
              activeStyle={{ background: activeToggle, border: "1px solid rgba(255,255,255,0.5)" }}
              onClick={() => onFiltersChange({ ...filters, communityFilter: "alumni" })}
            >
              Alumni only
            </TogglePill>
          </QuickRow>

          {/*
           * Year filter is intentionally cohort-only — it narrows the people
           * shown on the map by their cohort year, it does NOT move any pin.
           * The former "View by month" pivot was removed with the map
           * simplification: every person now appears at a single pin (their
           * profile location) regardless of when you're looking.
           */}
          <QuickRow label="Active in year">
            <TogglePill active={filters.year === null} activeStyle={{ background: activeToggle, border: "1px solid rgba(255,255,255,0.5)" }} onClick={() => setYear(null)}>
              Any year
            </TogglePill>
            {years.map((y) => (
              <TogglePill key={y} active={filters.year === y} activeStyle={{ background: activeToggle, border: "1px solid rgba(255,255,255,0.5)" }} onClick={() => setYear(y)}>
                {y}
              </TogglePill>
            ))}
          </QuickRow>
        </div>
      )}
    </div>
  );
}

/* ── Tiny helpers ───────────────────────────────────────────────────── */

function QuickRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function TogglePill({
  active,
  activeStyle,
  onClick,
  children,
}: {
  active: boolean;
  activeStyle: React.CSSProperties;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Badge
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className={`cursor-pointer transition-all text-[11px] px-2 py-0.5 ${
        active
          ? "text-gray-900 shadow-sm border-white/50"
          : "bg-neutral-100 border-neutral-200 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 hover:border-neutral-300"
      }`}
      style={active ? activeStyle : undefined}
    >
      {children}
    </Badge>
  );
}
