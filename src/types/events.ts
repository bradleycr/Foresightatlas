/**
 * Domain types for Node Programming & RSVP.
 *
 * Kept separate from people/travel types so the event system can evolve
 * independently. Designed for easy migration to Prisma/PostgreSQL later —
 * field names mirror what a relational schema would look like.
 */

export type NodeSlug = "berlin" | "sf" | "global";

export type EventType =
  | "coworking"
  | "workshop"
  | "conference"
  | "launch"
  | "open-house"
  | "demo"
  | "social"
  | "flagship"
  | "vision-weekend"
  | "other";

export type EventVisibility = "public" | "internal";

export type RSVPStatus = "going" | "interested" | "not-going";

/**
 * Per-node colour palette — all values are complete Tailwind utility strings
 * (so JIT picks them up) or raw CSS for inline styles.
 *
 * Berlin: indigo → soft rose  (softer, European feel)
 * SF:     warm amber  → clear sky   (lighter, West-Coast feel)
 */
export interface NodeColorTheme {
  /** Decorative CSS gradient — used as inline style on header strips */
  headerGradient: string;

  // ── Month navigator ────────────────────────────────────────────────────────
  monthSelected: string;       // full Tailwind classes for the selected cell
  monthSelectedLabel: string;  // month abbreviation colour when selected
  monthSelectedCount: string;  // count number colour when selected
  monthCurrent: string;        // non-selected current-month cell style
  monthCurrentLabel: string;   // month abbreviation for current (unselected)
  allUpcomingActive: string;   // "All upcoming" pill when active
  allUpcomingIdle: string;     // "All upcoming" pill when idle
  focusRing: string;           // focus-visible ring utility

  // ── Identity banner ────────────────────────────────────────────────────────
  avatarActiveBg: string;      // avatar bg when signed-in or trigger open
  avatarActiveText: string;    // avatar initials colour
  triggerOpenBorder: string;   // trigger border when dropdown open
  triggerOpenRing: string;     // trigger ring when dropdown open
  chevronActive: string;       // chevron icon colour when open
  searchFocusRing: string;     // search-input focus ring

  // ── EventCard ──────────────────────────────────────────────────────────────
  ctaBg: string;               // external-link CTA background
  ctaText: string;             // CTA text colour
  ctaBorder: string;           // CTA border
  ctaHover: string;            // CTA hover background
  ctaFocusRing: string;        // CTA focus ring
  linkText: string;            // "Read more" / "View all upcoming" link
  linkHover: string;           // link hover colour
}

/** A physical Foresight node (hub/location). */
export interface ForesightNode {
  slug: NodeSlug;
  name: string;
  city: string;
  country: string;
  coordinates: { lat: number; lng: number };
  timezone: string;
  description: string;
  gradient: string;
  accent: string;
  /** Colour palette for the programming page — pastel gradients matching the map sidebar. */
  theme: NodeColorTheme;
}

/** A single event instance (recurring events are pre-expanded). */
export interface NodeEvent {
  id: string;
  nodeSlug: NodeSlug;
  title: string;
  description: string;
  location: string;
  startAt: string; // ISO 8601 datetime
  endAt: string;
  type: EventType;
  tags: string[];
  visibility: EventVisibility;
  capacity: number | null;
  externalLink: string | null;
  recurrenceGroupId: string | null;
}

/** Persisted RSVP record for one person × one event. */
export interface RSVPRecord {
  eventId: string;
  personId: string;
  status: RSVPStatus;
  createdAt: string;
  updatedAt: string;
  /** Display name when read from sheet/API. */
  fullName?: string;
  /** Event title when read from sheet/API (so sheet view is human-readable). */
  eventTitle?: string;
}

/** Aggregated counts for a single event — derived at read time. */
export interface RSVPSummary {
  going: number;
  interested: number;
  notGoing: number;
  goingPersonIds: string[];
  interestedPersonIds: string[];
}

/* ── Node Table / Check-in ──────────────────────────────────────────── */

export type CheckInType = "checkin" | "planned";

/** A single person × date presence record at a node. */
export interface CheckIn {
  personId: string;
  fullName: string;
  nodeSlug: NodeSlug;
  /** Calendar date in YYYY-MM-DD format. */
  date: string;
  type: CheckInType;
  createdAt: string;
  updatedAt: string;
}

/** Day-level aggregate used by the week-view table. */
export interface DayCheckInSummary {
  date: string;
  people: CheckIn[];
}
