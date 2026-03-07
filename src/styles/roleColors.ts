import { RoleType } from "../types";

/**
 * Canonical color system for role types across the app.
 *
 * We keep this in one place so the map pins, filters, timeline bars,
 * and sidebar cards all speak the same visual language.
 */
export interface RoleColorSpec {
  start: string;
  end: string;
  text: string;
  solid: string;
}

export const ROLE_COLORS: Record<RoleType, RoleColorSpec> = {
  Fellow: {
    start: "#f2dcff",
    end: "#d8c6f7",
    text: "#5e3f7a",
    solid: "#b38ad9",
  },
  Grantee: {
    start: "#d9eefb",
    end: "#b9daf4",
    text: "#285b75",
    solid: "#6aa5cb",
  },
  "Prize Winner": {
    start: "#f8edc2",
    end: "#f2d6a2",
    text: "#7a5920",
    solid: "#d7aa5b",
  },
  "Senior Fellow": {
    start: "#dce2ff",
    end: "#becbf7",
    text: "#3d4f84",
    solid: "#8a9add",
  },
  Nodee: {
    start: "#ffe2cc",
    end: "#ffc8a6",
    text: "#8d5228",
    solid: "#e29463",
  },
};

/**
 * Primary gradient for a single role type.
 * Prefer getRolePillClass() so styling stays in CSS; use this only when class isn't possible.
 */
export const getRoleGradient = (role: RoleType): string => {
  const color = ROLE_COLORS[role];
  return `linear-gradient(135deg, ${color.start} 0%, ${color.end} 100%)`;
};

export const getRoleSolidColor = (role: RoleType): string => ROLE_COLORS[role].solid;
export const getRoleTextColor = (role: RoleType): string => ROLE_COLORS[role].text;

/** Tailwind-compatible class for role pills (single source of truth: index.css .role-pill-*) */
export const getRolePillClass = (role: RoleType): string => {
  const map: Record<RoleType, string> = {
    Fellow: "role-pill-fellow",
    Grantee: "role-pill-grantee",
    "Prize Winner": "role-pill-prize",
    "Senior Fellow": "role-pill-senior-fellow",
    Nodee: "role-pill-nodee",
  };
  return map[role] ?? "role-pill-fellow";
};


