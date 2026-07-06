/**
 * Nanowheels — a playful, trust-based count of community touch points.
 *
 * A nanowheel (◎) is earned any time a member shows up somewhere:
 *   • +1 per check-in at a node (CheckIns sheet)
 *   • +1 per RSVP with status "going" (RSVPs sheet)
 *
 * Counts are derived from the same merged caches as the rest of the app
 * (checkin.ts / rsvp.ts) so a check-in you just made shows up immediately,
 * without waiting for a second sheet read to catch up.
 */

import type { NodeSlug } from "../types/events";
import { fetchCheckInsFromAPI, getPersonCheckIns, toDateKey } from "./checkin";
import { fetchRSVPsFromAPI, getPersonRSVPs } from "./rsvp";

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

const NODE_SLUGS: NodeSlug[] = ["berlin", "sf", "global"];

/** Warm merged check-in / RSVP caches before reading person totals. */
async function ensureCachesWarm(): Promise<void> {
  const now = new Date();
  const start = toDateKey(
    new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
  );
  const end = toDateKey(
    new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
  );
  await Promise.all([
    ...NODE_SLUGS.map((slug) => fetchCheckInsFromAPI(slug, start, end)),
    fetchRSVPsFromAPI(),
  ]);
}

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

  try {
    await ensureCachesWarm();
  } catch {
    /* fall through — merged local state may still have fresh writes */
  }

  const checkIns = getPersonCheckIns(personId);
  const rsvps = getPersonRSVPs(personId).filter((r) => r.status === "going");

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
