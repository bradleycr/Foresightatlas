/**
 * Pin and popup markup shared by the Leaflet map and the globe.
 * Both views have to read as the same atlas: the Foresight mark, the role
 * badge, and the name list. Leaflet wraps this HTML in a divIcon; the globe
 * drops it into a DOM marker. The strings stay here so the two cannot drift.
 */

import { Person, RoleType } from "../../types";
import { ROLE_COLORS, getRoleGradient, getRoleTextColor } from "../../styles/roleColors";
import { effectiveIsAlumni } from "../../utils/cohortLabel";

export interface PinLocation {
  city: string;
  country: string;
  coordinates: { lat: number; lng: number };
  people: Array<{ person: Person }>;
}

/** Canonical order for segment layout so a mixed badge always looks the same. */
const ROLE_ORDER: RoleType[] = [
  "Fellow",
  "Senior Fellow",
  "Grantee",
  "Prize Winner",
  "Nodee",
  "Foresight Team",
];

/**
 * Numeric GeoJSON keys the globe's cluster index can aggregate.
 * The order matches ROLE_ORDER so a cluster badge segments the same way.
 */
export const ROLE_CLUSTER_KEYS: Array<{ key: string; role: RoleType }> = [
  { key: "fellow", role: "Fellow" },
  { key: "seniorFellow", role: "Senior Fellow" },
  { key: "grantee", role: "Grantee" },
  { key: "prizeWinner", role: "Prize Winner" },
  { key: "nodee", role: "Nodee" },
  { key: "foresightTeam", role: "Foresight Team" },
];

export type CommunityStatus = "current" | "alumni" | "mixed";

export function getCommunityStatus(people: Person[]): CommunityStatus {
  const alumniCount = people.filter((person) => effectiveIsAlumni(person)).length;
  if (alumniCount === 0) return "current";
  if (alumniCount === people.length) return "alumni";
  return "mixed";
}

export function communityStatusFromCounts(personCount: number, alumniCount: number): CommunityStatus {
  if (personCount <= 0 || alumniCount <= 0) return "current";
  if (alumniCount >= personCount) return "alumni";
  return "mixed";
}

/**
 * Badge background: one color for a single role type; segmented (halves, thirds,
 * or quarters) for multiple types so you can see the mix at a glance.
 */
export function createRoleBasedBadgeBackground(roleTypes: Set<RoleType>): string {
  const roles = ROLE_ORDER.filter((role) => roleTypes.has(role));
  if (roles.length === 0) return "linear-gradient(135deg, #f2dcff 0%, #d8c6f7 100%)";
  if (roles.length === 1) {
    const { start, end } = ROLE_COLORS[roles[0]];
    return `linear-gradient(135deg, ${start} 0%, ${end} 100%)`;
  }
  if (roles.length === 2) {
    const [a, b] = roles.map((role) => ROLE_COLORS[role].end);
    return `conic-gradient(from 0deg, ${a} 0deg 180deg, ${b} 180deg 360deg)`;
  }
  if (roles.length === 3) {
    const [a, b, c] = roles.map((role) => ROLE_COLORS[role].end);
    return `conic-gradient(from 0deg, ${a} 0deg 120deg, ${b} 120deg 240deg, ${c} 240deg 360deg)`;
  }
  const [a, b, c, d] = roles.slice(0, 4).map((role) => ROLE_COLORS[role].end);
  return `conic-gradient(from 0deg, ${a} 0deg 90deg, ${b} 90deg 180deg, ${c} 180deg 270deg, ${d} 270deg 360deg)`;
}

function badgeChrome(communityStatus: CommunityStatus): { border: string; shadow: string; iconFilter: string } {
  if (communityStatus === "alumni") {
    return {
      border: "#cbd5e1",
      shadow: "0 2px 8px rgba(100, 116, 139, 0.2)",
      iconFilter: "grayscale(0.35) saturate(0.75) opacity(0.88) drop-shadow(0 4px 10px rgba(100, 116, 139, 0.24))",
    };
  }
  if (communityStatus === "mixed") {
    return {
      border: "#f8fafc",
      shadow: "0 2px 8px rgba(15, 23, 42, 0.22)",
      iconFilter: "saturate(0.92) drop-shadow(0 6px 14px rgba(15, 23, 42, 0.18))",
    };
  }
  return {
    border: "#ffffff",
    shadow: "0 2px 8px rgba(15, 23, 42, 0.22)",
    iconFilter: "drop-shadow(0 6px 14px rgba(15, 23, 42, 0.22))",
  };
}

/** The Foresight mark with a count badge. Anchor the bottom center on the city. */
export function locationPinHtml(options: {
  count: number;
  roleTypes: Set<RoleType>;
  communityStatus: CommunityStatus;
  isSelected: boolean;
  iconUrl: string;
}): string {
  const { count, roleTypes, communityStatus, isSelected, iconUrl } = options;
  const background = createRoleBasedBadgeBackground(roleTypes);
  const iconSize = isSelected ? 48 : 40;
  const badgeSize = isSelected ? 28 : 24;
  const chrome = badgeChrome(communityStatus);

  return `
    <div style="position: relative; width: ${iconSize}px; height: ${iconSize}px;">
      <img
        src="${iconUrl}"
        alt="Location"
        style="width: ${iconSize}px; height: ${iconSize}px; filter: ${chrome.iconFilter};"
      />
      <div style="
        position: absolute;
        top: -8px;
        right: -8px;
        width: ${badgeSize}px;
        height: ${badgeSize}px;
        border-radius: 50%;
        background: ${background};
        border: 2px solid ${chrome.border};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: ${chrome.shadow};
        font-weight: 600;
        font-size: ${isSelected ? "12px" : "10px"};
        color: #fff;
        text-shadow: 0 0 1px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.25);
      ">
        ${count}
      </div>
    </div>
  `;
}

/** A single role-colored circle. Used when several cities still share one bubble. */
export function clusterBadgeHtml(options: {
  count: number;
  roleTypes: Set<RoleType>;
  communityStatus: CommunityStatus;
}): string {
  const { count, roleTypes, communityStatus } = options;
  const background = createRoleBasedBadgeBackground(roleTypes);
  const border = badgeChrome(communityStatus).border;
  const singleCircleStyle = `background:${background};border:2px solid ${border};border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.2);font-weight:600;font-size:12px;color:#fff;text-shadow:0 0 1px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.25);overflow:hidden;transform:translateZ(0)`;
  return `<div class="marker-cluster-role-outer" style="${singleCircleStyle}">${count}</div>`;
}

export function rolesFromClusterFlags(properties: Record<string, unknown>): Set<RoleType> {
  const roles = new Set<RoleType>();
  for (const { key, role } of ROLE_CLUSTER_KEYS) {
    if (Number(properties[key]) > 0) roles.add(role);
  }
  return roles;
}

const escapeHtml = (value: string) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Popup body: place name, then a scrollable list of people at that pin. */
export function buildPopupHtml(marker: PinLocation): string {
  const cityCountry = escapeHtml(marker.country ? `${marker.city}, ${marker.country}` : marker.city);
  const count = marker.people.length;
  const countLabel = count === 1 ? "1 person" : `${count} people`;
  const rows = marker.people
    .map(({ person }) => {
      const name = escapeHtml(person.fullName);
      const roleGradient = getRoleGradient(person.roleType);
      const roleStyle = `background:${roleGradient};color:${getRoleTextColor(person.roleType)}`;
      const alumni = effectiveIsAlumni(person)
        ? '<span class="text-[11px] px-1.5 py-0.5 rounded font-medium text-slate-50 shrink-0" style="background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%); border: 1px solid rgba(100,116,139,0.4)">Alumni</span>'
        : '<span class="text-[11px] px-1.5 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 shrink-0">Current</span>';
      return `<button type="button" class="map-node-popup__person w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px] sm:min-h-[40px] flex flex-col justify-center gap-1 cursor-pointer" data-person-id="${escapeHtml(person.id)}">
        <span class="text-sm font-medium text-gray-900 truncate">${name}</span>
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-[11px] px-1.5 py-0.5 rounded font-medium shrink-0" style="${roleStyle}">${escapeHtml(person.roleType)}</span>
          ${alumni}
        </div>
      </button>`;
    })
    .join("");
  return `<div class="map-node-popup__inner bg-white">
    <div class="map-node-popup__header px-3 pt-2.5 pb-2 pr-10 border-b border-gray-100">
      <h4 class="font-semibold text-gray-900 text-sm leading-tight sm:text-base font-heading">${cityCountry}</h4>
      <p class="text-xs text-gray-500 mt-0.5">${countLabel}</p>
    </div>
    <div class="map-node-popup__list">${rows}</div>
  </div>`;
}

/**
 * Name-list gestures stay inside the popup. The map underneath must not pan
 * or zoom while a finger is moving through the people.
 */
export function bindPopupPeople(root: HTMLElement, onPerson: (personId: string) => void): void {
  const list = root.querySelector(".map-node-popup__list");
  if (list instanceof HTMLElement) {
    const stop = (event: Event) => event.stopPropagation();
    list.addEventListener("wheel", stop);
    list.addEventListener("touchmove", stop);
    list.addEventListener("pointerdown", stop);
  }
  root.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement | null)?.closest?.("[data-person-id]");
    const id = target?.getAttribute("data-person-id");
    if (id) onPerson(id);
  });
}
