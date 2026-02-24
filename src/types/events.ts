/**
 * Domain types for Node Programming & RSVP.
 *
 * Kept separate from people/travel types so the event system can evolve
 * independently. Designed for easy migration to Prisma/PostgreSQL later —
 * field names mirror what a relational schema would look like.
 */

export type NodeSlug = "berlin" | "sf";

export type EventType =
  | "coworking"
  | "workshop"
  | "conference"
  | "launch"
  | "open-house"
  | "demo"
  | "social"
  | "flagship"
  | "other";

export type EventVisibility = "public" | "internal";

export type RSVPStatus = "going" | "interested" | "not-going";

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
}

/** Aggregated counts for a single event — derived at read time. */
export interface RSVPSummary {
  going: number;
  interested: number;
  notGoing: number;
  goingPersonIds: string[];
  interestedPersonIds: string[];
}
