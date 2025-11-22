// Data models for Foresight Fellows Map & Timeline

export type RoleType = "Fellow" | "Grantee" | "Prize Winner";
export type PrimaryNode = "Global" | "Berlin Node" | "Bay Area Node";
export type TravelWindowType = "Residency" | "Conference" | "Workshop" | "Visit" | "Other";
export type SuggestionStatus = "Pending" | "Accepted" | "Rejected";
export type ChangeType = "New entry" | "Update location" | "Add travel window";
export type Granularity = "Year" | "Month" | "Week";
export type TimelineViewMode = "person" | "location";

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
  passwordPlaceholder: string; // Password stored in JSON database (consider hashing for production)
}

export interface Filters {
  search: string;
  programs: RoleType[];
  focusTags: string[];
  nodes: PrimaryNode[];
  cities: string[]; // Selected cities to filter by
  year: number | null; // null means "All time"
  granularity: Granularity;
  /**
   * Reference date used for Month and Week timeline views and map time window.
   * Defaults to "today" but can be moved by the user to explore other periods.
   */
  referenceDate: string; // ISO date string
  timelineViewMode: TimelineViewMode; // "person" or "location" - how to organize the timeline rows
}
