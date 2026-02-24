import { RoleType } from "../types";

/**
 * Canonical color system for role types across the app.
 *
 * We keep this in one place so the map pins, filters, timeline bars,
 * and sidebar cards all speak the same visual language.
 */
export const ROLE_COLORS: Record<RoleType, { start: string; end: string }> = {
  Fellow: { start: "#ddd6fe", end: "#c4b5fd" }, // Soft purple
  Grantee: { start: "#bfdbfe", end: "#93c5fd" }, // Sky blue
  "Prize Winner": { start: "#fde68a", end: "#fcd34d" }, // Warm gold
};

/**
 * Primary gradient for a single role type.
 * Prefer getRolePillClass() so styling stays in CSS; use this only when class isn't possible.
 */
export const getRoleGradient = (role: RoleType): string => {
  const color = ROLE_COLORS[role];
  return `linear-gradient(135deg, ${color.start} 0%, ${color.end} 100%)`;
};

/** Tailwind-compatible class for role pills (single source of truth: globals.css .role-pill-*) */
export const getRolePillClass = (role: RoleType): string => {
  const map: Record<RoleType, string> = {
    Fellow: "role-pill-fellow",
    Grantee: "role-pill-grantee",
    "Prize Winner": "role-pill-prize",
  };
  return map[role] ?? "role-pill-fellow";
};


