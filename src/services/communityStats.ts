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
  uniqueParticipants: number;
  coworkingEngagements: number;
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

export interface CommunityStats {
  generatedAt: string;
  totals: CommunityStatsTotals;
  byNode: NodeCommunityStats[];
  monthly: CommunityStatsMonth[];
  topEvents: TopEventStat[];
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
