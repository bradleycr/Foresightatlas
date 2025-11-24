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
  
