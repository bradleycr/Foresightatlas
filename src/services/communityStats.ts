/**
 * Community engagement totals — nanowheels, check-ins, RSVPs by node.
 */

import { getApiBase } from "./api-base";

export type NodeSlug = "berlin" | "sf" | "global";

export interface NodeCommunityStats {
  nodeSlug: NodeSlug;
  label: string;
  nanowheels: number;
  checkIns: number;
  rsvpsGoing: number;
  coworkingEngagements: number;
  uniqueParticipants: number;
}

export interface CommunityStatsTotals {
  nanowheels: number;
  checkIns: number;
  rsvpsGoing: number;
  rsvpsInterested: number;
  uniqueParticipants: number;
  coworkingEngagements: number;
  eventsWithGoing: number;
  upcomingEvents: number;
  upcomingGoingRsvps: number;
  activeTravelWindows: number;
}

export interface RosterNodeCount {
  nodeSlug: NodeSlug;
  label: string;
  count: number;
}

export interface RosterStats {
  total: number;
  publicProfiles: number;
  claimed: number;
  unclaimed: number;
  onMap: number;
  withoutLocation: number;
  withPhoto: number;
  openToMeet: number;
  withContact: number;
  alumni: number;
  current: number;
  byPrimaryNode: RosterNodeCount[];
}

export interface CommunityStatsMonth {
  month: string;
  checkIns: number;
  rsvpsGoing: number;
  nanowheels: number;
}

export interface TopEventStat {
  eventId: string;
  title: string;
  nodeSlug: NodeSlug;
  going: number;
  isCoworking: boolean;
}

export interface TopParticipantStat {
  personId: string;
  fullName: string;
  nanowheels: number;
  checkIns: number;
  rsvpsGoing: number;
}

export interface CommunityStatsActivity {
  checkInsLast30Days: number;
  avgNanowheelsPerParticipant: number;
}

export interface CommunityStats {
  generatedAt: string;
  totals: CommunityStatsTotals;
  roster: RosterStats;
  thisMonth: CommunityStatsMonth;
  activity: CommunityStatsActivity;
  byNode: NodeCommunityStats[];
  monthly: CommunityStatsMonth[];
  topEvents: TopEventStat[];
  topParticipants: TopParticipantStat[];
}

export async function fetchCommunityStats(token: string): Promise<CommunityStats> {
  const res = await fetch(`${getApiBase()}/community-stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Failed to load stats (${res.status})`);
  }
  return res.json() as Promise<CommunityStats>;
}
