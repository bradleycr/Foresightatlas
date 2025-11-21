// Data models for Foresight Fellows Map & Timeline

export type RoleType = "Fellow" | "Grantee" | "Prize Winner";
export type PrimaryNode = "Global" | "Berlin Node" | "Bay Area Node";
export type TravelWindowType = "Residency" | "Conference" | "Workshop" | "Visit" | "Other";
export type SuggestionStatus = "Pending" | "Accepted" | "Rejected";
export type ChangeType = "New entry" | "Update location" | "Add travel window";
export type Granularity = "Year" | "Month" | "Week";

export interface Person {
  id: string;
  fullName: string;
  roleType: RoleType;
  fellowshipCohortYear: number;
  focusTags: string[];
  homeBaseCity: string;
  homeBaseCountry: string;
  currentCity: string;
  currentCountry: string;
  currentCoordinates: { lat: number; lng: number };
  primaryNode: PrimaryNode;
  profileUrl: string;
  contactUrlOrHandle: string | null;
  shortProjectTagline: string;
  expandedProjectDescription: string;
  isAlumni: boolean;
}

export interface TravelWindow {
  id: string;
  personId: string;
  title: string;
  city: string;
  country: string;
  coordinates: { lat: number; lng: number };
  startDate: string; // ISO string
  endDate: string; // ISO string
  type: TravelWindowType;
  notes: string;
}

export interface LocationSuggestion {
  id: string;
  personName: string;
  personEmailOrHandle: string;
  requestedChangeType: ChangeType;
  requestedPayload: any; // JSON blob
  createdAt: string; // ISO string
  status: SuggestionStatus;
}

export interface AdminUser {
  id: string;
  displayName: string;
  email: string;
  passwordPlaceholder: string; // TODO: replace with real auth
}

export interface Filters {
  search: string;
  programs: RoleType[];
  focusTags: string[];
  nodes: PrimaryNode[];
  year: number;
  granularity: Granularity;
}
