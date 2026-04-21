/**
 * Nanowheels — Foresight's trust-based internal currency.
 *
 * A nanowheel (◎) is earned any time a member shows up somewhere:
 *   • +1 per check-in at a node (CheckIns sheet)
 *   • +1 per RSVP with status "going" (RSVPs sheet)
 *
 * Everything here is **derived** at read time from data the app already has.
 * No new sheet tabs, no new API routes, no new writes. That means the count
 * can never drift from the source of truth, and "undoing" an RSVP or removing
 * a check-in naturally subtracts the wheel without special-casing.
 *
 * The name nods to Foresight's roots in molecular nanotechnology — the logo
 * is a stylised nanoscale wheel, and this is the scoreboard for how many
 * times someone has "turned the wheel" of the community.
 */

import type { CheckIn, NodeSlug, RSVPRecord } from "../types/events";
import { getApiBase } from "./api-base";

/** Per-person nanowheel breakdown. Totals are always checkIns + rsvpsGoing. */
export interface NanowheelSummary {
  personId: string;
  total: number;
  checkIns: number;
  rsvpsGoing: number;
  /** Most recent 5 earning events (newest first) for the "recent wheels" list. */
  recent: NanowheelActivity[];
}

/** A single earning event — what someone did to pick up a wheel. */
export interface NanowheelActivity {
  kind: "checkin" | "rsvp";
  /** ISO timestamp of when it was earned (updatedAt for RSVPs, date for check-ins). */
  at: string;
  /** Human-readable label: "Checked in at Berlin Node" / "RSVP’d to Open House". */
  label: string;
  /**
   * Optional slug reference: node slug for check-ins, event title/id for RSVPs.
   * Used by the profile UI's "recent activity" list; otherwise ignored.
   */
  ref?: string;
}

/* ── Raw fetchers — plain REST, no caching helpers ───────────────────── */

/**
 * Fetch every check-in for the given person across all nodes.
 *
 * `/api/checkins` only filters by date range and node, not personId, so we
 * request a wide window and filter client-side. Practical member volumes keep
 * this cheap; we cap at a year back + a year forward to bound growth.
 */
async function fetchPersonCheckIns(personId: string): Promise<CheckIn[]> {
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const oneYearAhead = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  const params = new URLSearchParams({
    startDate: oneYearAgo.toISOString().slice(0, 10),
    endDate: oneYearAhead.toISOString().slice(0, 10),
  });

  try {
    const res = await fetch(`${getApiBase()}/checkins?${params}`);
    if (!res.ok) return [];
    const list = (await res.json()) as CheckIn[];
    if (!Array.isArray(list)) return [];
    const mine = list.filter((c) => c.personId === personId);
    /* Sheet is append-only: collapse to latest row per (node, day); drop withdrawals. */
    const byDay = new Map<string, CheckIn>();
    for (const c of mine) {
      const k = `${c.nodeSlug}|${c.date}`;
      const prev = byDay.get(k);
      if (!prev || new Date(c.updatedAt) >= new Date(prev.updatedAt)) {
        byDay.set(k, c);
      }
    }
    return [...byDay.values()].filter((c) => c.type !== "withdrawn");
  } catch {
    return [];
  }
}

/**
 * Fetch every RSVP for the given person. The API returns the full list; we
 * filter down to rows belonging to this person with status "going".
 */
async function fetchPersonGoingRsvps(personId: string): Promise<RSVPRecord[]> {
  try {
    const res = await fetch(`${getApiBase()}/rsvps`);
    if (!res.ok) return [];
    const list = (await res.json()) as RSVPRecord[];
    if (!Array.isArray(list)) return [];
    return list.filter((r) => r.personId === personId && r.status === "going");
  } catch {
    return [];
  }
}

/* ── Public API ──────────────────────────────────────────────────────── */

/**
 * Compute a live nanowheel summary for one person.
 *
 * Safe to call anywhere (even when check-in / RSVP APIs are down) — returns
 * zeros on failure rather than throwing, so the badge degrades gracefully.
 */
export async function getNanowheelSummary(personId: string): Promise<NanowheelSummary> {
  if (!personId) {
    return { personId: "", total: 0, checkIns: 0, rsvpsGoing: 0, recent: [] };
  }

  const [checkIns, rsvps] = await Promise.all([
    fetchPersonCheckIns(personId),
    fetchPersonGoingRsvps(personId),
  ]);

  const activity: NanowheelActivity[] = [
    ...checkIns.map<NanowheelActivity>((c) => ({
      kind: "checkin",
      at: c.updatedAt || c.createdAt || `${c.date}T12:00:00Z`,
      label: `Checked in at ${formatNodeName(c.nodeSlug)}`,
      ref: c.nodeSlug,
    })),
    ...rsvps.map<NanowheelActivity>((r) => ({
      kind: "rsvp",
      at: r.updatedAt || r.createdAt || new Date().toISOString(),
      label: r.eventTitle ? `Going to “${r.eventTitle}”` : "RSVP’d going to an event",
      ref: r.eventId,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    personId,
    total: checkIns.length + rsvps.length,
    checkIns: checkIns.length,
    rsvpsGoing: rsvps.length,
    recent: activity.slice(0, 5),
  };
}

/**
 * Lightweight variant used when we only need a total (e.g. in list views).
 * Consumers who need the breakdown should call {@link getNanowheelSummary}.
 */
export async function getNanowheelTotal(personId: string): Promise<number> {
  const summary = await getNanowheelSummary(personId);
  return summary.total;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function formatNodeName(slug: NodeSlug): string {
  if (slug === "berlin") return "Berlin Node";
  if (slug === "sf") return "SF Node";
  return "Foresight";
}
