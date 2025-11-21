import { Search, X } from "lucide-react";
import { Filters, RoleType, PrimaryNode, Granularity } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

interface FiltersBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onReset: () => void;
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

export function FiltersBar({ filters, onFiltersChange, onReset }: FiltersBarProps) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3];

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
    const newNodes = filters.nodes.includes(node)
      ? filters.nodes.filter((n) => n !== node)
      : [...filters.nodes, node];
    onFiltersChange({ ...filters, nodes: newNodes });
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
            value={filters.year}
            onChange={(e) =>
              onFiltersChange({ ...filters, year: parseInt(e.target.value) })
            }
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">View:</label>
          <div className="flex gap-1 bg-gray-100 rounded-md p-1">
            {(["Year", "Month", "Week"] as Granularity[]).map((gran) => (
              <button
                key={gran}
                onClick={() => onFiltersChange({ ...filters, granularity: gran })}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  filters.granularity === gran
                    ? "bg-teal-500 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {gran}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={onReset} variant="outline" size="sm">
          Current 12 months
        </Button>
      </div>

      {/* Filter Pills */}
      <div className="space-y-3">
        {/* Programs */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 min-w-[80px]">Program:</span>
          {PROGRAMS.map((program) => (
            <Badge
              key={program}
              variant={filters.programs.includes(program) ? "default" : "outline"}
              className={`cursor-pointer ${
                filters.programs.includes(program)
                  ? "bg-teal-500 hover:bg-teal-600"
                  : "hover:bg-gray-100"
              }`}
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
              className={`cursor-pointer ${
                filters.focusTags.includes(focus)
                  ? "bg-teal-500 hover:bg-teal-600"
                  : "hover:bg-gray-100"
              }`}
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
              className={`cursor-pointer ${
                filters.nodes.includes(node)
                  ? "bg-teal-500 hover:bg-teal-600"
                  : "hover:bg-gray-100"
              }`}
              onClick={() => toggleNode(node)}
            >
              {node}
              {filters.nodes.includes(node) && <X className="ml-1 size-3" />}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}