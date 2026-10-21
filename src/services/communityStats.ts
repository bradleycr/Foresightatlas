/**
 * Community engagement totals — nanowheels, check-ins, RSVPs by node.
 * Foresight Team only (API returns 403 otherwise).
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

export interface ClaimReminderRow {
  fullName: string;
  email: string;
  roleType: string;
  primaryNode: string;
  personId: string;
}

export interface ClaimFunnelStats {
  claimed: number;
  unclaimed: number;
  unclaimedWithEmail: number;
  unclaimedNoEmail: number;
  claimedLast30Days: number;
  reminderList: ClaimReminderRow[];
}

export interface GeoCount {
  name: string;
  count: number;
}

export interface GeographyStats {
  withCountry: number;
  countries: GeoCount[];
  continents: GeoCount[];
}

export interface RsvpSourceStats {
  atlas: number;
  luma: number;
  total: number;
}

export interface CheckInNodeWindow {
  nodeSlug: NodeSlug;
  label: string;
  last7Days: number;
  last30Days: number;
  allTime: number;
}

export interface CheckInWindows {
  last7Days: number;
  last30Days: number;
  allTime: number;
  byNode: CheckInNodeWindow[];
}

export interface ConnectionsStats {
  activeEdges: number;
  activeBookmarks: number;
}

export interface LoginWindowCounts {
  today: number;
  last7Days: number;
  last30Days: number;
  allTime: number;
  uniquePeopleAllTime?: number;
  uniquePeopleLast30Days?: number;
}

export interface LoginStats {
  trackingStartedAt: string | null;
  totalEvents: number;
  logins: LoginWindowCounts;
  claims: Omit<LoginWindowCounts, "uniquePeopleAllTime" | "uniquePeopleLast30Days">;
  generatedAt: string;
}

export interface VisitsStats {
  available: boolean;
  reason?: string;
  hint?: string;
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
  checkInsLast7Days: number;
  checkInsLast30Days: number;
  avgNanowheelsPerParticipant: number;
}

export interface CommunityStats {
  generatedAt: string;
  totals: CommunityStatsTotals;
  roster: RosterStats;
  claims: ClaimFunnelStats;
  geography: GeographyStats;
  rsvpSources: RsvpSourceStats;
  checkIns: CheckInWindows;
  connections: ConnectionsStats;
  logins: LoginStats | null;
  visits: VisitsStats;
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

/** CSV for claim-reminder outreach — names + emails only. */
export function claimReminderCsv(rows: ClaimReminderRow[]): string {
  const escape = (v: string) => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = ["fullName", "email", "roleType", "primaryNode"].join(",");
  const lines = rows.map((r) =>
    [r.fullName, r.email, r.roleType, r.primaryNode].map(escape).join(","),
  );
  return [header, ...lines].join("\n");
}

export function downloadClaimReminderCsv(rows: ClaimReminderRow[]): void {
  const csv = claimReminderCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `claim-reminders-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
