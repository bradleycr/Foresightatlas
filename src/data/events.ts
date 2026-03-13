/**
 * Seed events for all nodes.
 *
 * Used only when the Google Sheet Events tab is empty/unavailable or when
 * merging with events.json (e.g. static build). Sheet is the source of truth
 * when GET /api/database returns events.
 */

import { NodeEvent, EventType, NodeSlug } from "../types/events";
import { getEventsFromSheet } from "../services/database";

/* ── helpers ────────────────────────────────────────────────────────── */

function eid(node: NodeSlug, slug: string, date: string): string {
  return `${node}-${slug}-${date}`.replace(/\s+/g, "-").toLowerCase();
}

function thursdays(start: Date, end: Date): Date[] {
  const result: Date[] = [];
  const cur = new Date(start);
  while (cur.getDay() !== 4) cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    result.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return result;
}

/* ── Berlin: recurring coworking ────────────────────────────────────── */

function berlinWeeklyCoworking(): NodeEvent[] {
  return thursdays(new Date("2026-04-01"), new Date("2026-12-31")).map((d) => {
    const iso = d.toISOString().split("T")[0];
    return {
      id: eid("berlin", "coworking", iso),
      nodeSlug: "berlin",
      title: "Weekly Coworking Lunch & Session",
      description:
        "Open coworking afternoon at the Berlin Node. Drop in for lunch, stay to work, collaborate, and connect with fellow researchers and builders.",
      location: "Berlin Node",
      startAt: `${iso}T12:00:00+02:00`,
      endAt: `${iso}T16:00:00+02:00`,
      type: "coworking",
      tags: ["recurring", "open", "coworking"],
      visibility: "internal",
      capacity: null,
      externalLink: null,
      recurrenceGroupId: "berlin-weekly-coworking-2026",
    };
  });
}

/* ── Berlin: special one-off events ─────────────────────────────────── */

const BERLIN_SPECIALS: NodeEvent[] = [
  {
    id: "berlin-open-house-2026-03-01",
    nodeSlug: "berlin",
    title: "Open House",
    description:
      "Come visit the Berlin Node space. Meet the team, see the facilities, and learn about upcoming programming and residency opportunities.",
    location: "Berlin Node",
    startAt: "2026-03-01T14:00:00+01:00",
    endAt: "2026-03-01T18:00:00+01:00",
    type: "open-house",
    tags: ["open-house", "community"],
    visibility: "public",
    capacity: 50,
    externalLink: "https://luma.com/foresightinstitute",
    recurrenceGroupId: null,
  },
  {
    id: "berlin-open-house-2026-03-19",
    nodeSlug: "berlin",
    title: "Open House",
    description:
      "Second open house at the Berlin Node — an afternoon of tours, conversations, and introductions to the Foresight community in Europe.",
    location: "Berlin Node",
    startAt: "2026-03-19T14:00:00+01:00",
    endAt: "2026-03-19T18:00:00+01:00",
    type: "open-house",
    tags: ["open-house", "community"],
    visibility: "public",
    capacity: 50,
    externalLink: null,
    recurrenceGroupId: null,
  },
  {
    id: "berlin-node-launch-2026-04-01",
    nodeSlug: "berlin",
    title: "Berlin Node Launch Event",
    description:
      "The official launch of the Foresight Berlin Node. Join us to celebrate the opening with keynotes, demos, and the first community gathering at our new European hub.",
    location: "Berlin Node",
    startAt: "2026-04-01T17:00:00+02:00",
    endAt: "2026-04-01T22:00:00+02:00",
    type: "launch",
    tags: ["launch", "flagship", "celebration"],
    visibility: "public",
    capacity: 100,
    externalLink: null,
    recurrenceGroupId: null,
  },
  {
    id: "berlin-ai-science-2026-07-18",
    nodeSlug: "berlin",
    title: "AI for Science Workshop",
    description:
      "A two-day intensive workshop bringing together researchers at the frontier of AI-driven scientific discovery. Presentations, breakout sessions, and hands-on collaboration at the Berlin Node.",
    location: "Berlin Node",
    startAt: "2026-07-18T09:00:00+02:00",
    endAt: "2026-07-19T18:00:00+02:00",
    type: "workshop",
    tags: ["ai", "science", "workshop", "flagship"],
    visibility: "public",
    capacity: 60,
    externalLink: null,
    recurrenceGroupId: null,
  },
];

/* ── Vision Weekends & flagship workshops (from Event_3 schedule) ─────────── */

const VISION_WEEKENDS_AND_WORKSHOPS: NodeEvent[] = [
  {
    id: "vision-weekend-puerto-rico-2026-02-06",
    nodeSlug: "global",
    title: "Vision Weekend — Puerto Rico",
    description:
      "Foresight Vision Weekend in San Juan. Connect with grantees, fellows, and the event team for a focused gathering on long-term vision and collaboration.",
    location: "San Juan",
    startAt: "2026-02-06T09:00:00-04:00",
    endAt: "2026-02-08T18:00:00-04:00",
    type: "vision-weekend",
    tags: ["vision-weekend", "flagship", "grantees", "fellows"],
    visibility: "internal",
    capacity: null,
    externalLink: null,
    recurrenceGroupId: null,
  },
  {
    id: "vision-weekend-uk-2026-06-05",
    nodeSlug: "global",
    title: "Vision Weekend — UK",
    description:
      "Foresight Vision Weekend in London. Brings together grantees, fellows, and the event team for vision-setting and community building in Europe.",
    location: "London",
    startAt: "2026-06-05T09:00:00+01:00",
    endAt: "2026-06-07T18:00:00+01:00",
    type: "vision-weekend",
    tags: ["vision-weekend", "flagship", "grantees", "fellows"],
    visibility: "internal",
    capacity: null,
    externalLink: null,
    recurrenceGroupId: null,
  },
  {
    id: "vision-weekend-us-sf-2026-12-04",
    nodeSlug: "global",
    title: "Vision Weekend — US (SF)",
    description:
      "Foresight Vision Weekend in San Francisco. Grantees, fellows, and SF node community gather for the flagship US vision weekend.",
    location: "SF",
    startAt: "2026-12-04T09:00:00-08:00",
    endAt: "2026-12-06T18:00:00-08:00",
    type: "vision-weekend",
    tags: ["vision-weekend", "flagship", "grantees", "fellows", "node-sf"],
    visibility: "internal",
    capacity: null,
    externalLink: null,
    recurrenceGroupId: null,
  },
  {
    id: "workshop-ai-for-ai-berlin-2026-07-17",
    nodeSlug: "berlin",
    title: "Workshop: AI for AI (Berlin)",
    description:
      "Berlin-node workshop on AI for AI: research and practice at the intersection of AI safety and capability. Hands-on sessions and discussions at the Berlin Node.",
    location: "Berlin",
    startAt: "2026-07-17T09:00:00+02:00",
    endAt: "2026-07-19T18:00:00+02:00",
    type: "workshop",
    tags: ["workshop", "ai", "berlin", "node-berlin"],
    visibility: "internal",
    capacity: null,
    externalLink: null,
    recurrenceGroupId: null,
  },
  {
    id: "workshop-existential-hope-korea-2026-07-07",
    nodeSlug: "global",
    title: "Workshop: Existential Hope (Korea)",
    description:
      "Workshop on existential hope and long-term futures, held in South Korea. Cross-regional gathering for fellows and collaborators.",
    location: "South Korea",
    startAt: "2026-07-07T09:00:00+09:00",
    endAt: "2026-07-09T18:00:00+09:00",
    type: "workshop",
    tags: ["workshop", "existential-hope", "korea"],
    visibility: "internal",
    capacity: null,
    externalLink: null,
    recurrenceGroupId: null,
  },
  {
    id: "workshop-ai-for-science-sf-2026-09-25",
    nodeSlug: "sf",
    title: "Workshop: AI for Science (SF)",
    description:
      "SF workshop on AI for science: frontier research and applications. Grantees, fellows, and both nodes invited. Team days aligned.",
    location: "SF",
    startAt: "2026-09-25T09:00:00-07:00",
    endAt: "2026-09-27T18:00:00-07:00",
    type: "workshop",
    tags: ["workshop", "ai", "science", "node-sf", "node-berlin", "team-days"],
    visibility: "internal",
    capacity: null,
    externalLink: null,
    recurrenceGroupId: null,
  },
];

/* ── San Francisco: monthly demo days ───────────────────────────────── */

function sfDemoDays(): NodeEvent[] {
  return Array.from({ length: 9 }, (_, i) => {
    const month = i + 4; // Apr–Dec
    const d = new Date(2026, month - 1, 1);
    while (d.getDay() !== 3) d.setDate(d.getDate() + 1); // first Wednesday
    const iso = d.toISOString().split("T")[0];
    return {
      id: eid("sf", "demo-day", iso),
      nodeSlug: "sf" as NodeSlug,
      title: "Monthly Demo Day",
      description:
        "Fellows and grantees present their latest work. Lightning talks, demos, and feedback sessions with the Bay Area community.",
      location: "San Francisco Node",
      startAt: `${iso}T18:00:00-07:00`,
      endAt: `${iso}T21:00:00-07:00`,
      type: "demo" as EventType,
      tags: ["demo", "monthly", "presentations"],
      visibility: "internal",
      capacity: 40,
      externalLink: null,
      recurrenceGroupId: "sf-monthly-demo-2026",
    };
  });
}

/* ── public API ──────────────────────────────────────────────────────── */

let _cache: NodeEvent[] | null = null;
let _dynamicLoaded = false;

/**
 * Load events: Google Sheet (GET /api/database) is the only source of truth.
 * When the sheet returns events we use and cache them. When the sheet has none
 * (or the API is unavailable), we use in-code seed events only — no static
 * events.json or other backup; sheet-first everywhere.
 */
export async function loadEvents(): Promise<NodeEvent[]> {
  if (_dynamicLoaded && _cache) return _cache;

  const fromSheet = await getEventsFromSheet();
  if (Array.isArray(fromSheet) && fromSheet.length > 0) {
    _cache = fromSheet.sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
    _dynamicLoaded = true;
    return _cache;
  }

  return getAllEvents();
}

function getSeedEvents(): NodeEvent[] {
  return [
    ...BERLIN_SPECIALS,
    ...VISION_WEEKENDS_AND_WORKSHOPS,
    ...berlinWeeklyCoworking(),
    ...sfDemoDays(),
  ].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
}

export function getAllEvents(): NodeEvent[] {
  if (!_cache) {
    _cache = getSeedEvents();
  }
  return _cache;
}

export function getEventsByNode(slug: NodeSlug): NodeEvent[] {
  if (slug === "global") return getEventsForGlobal();
  return getAllEvents().filter((e) => e.nodeSlug === slug);
}

/** Events for the Global programming page: only events not tied to a specific node (Vision Weekends, global workshops). Node-specific events (open houses, node launch, coworking, demo days) show only on Berlin or SF. */
export function getEventsForGlobal(): NodeEvent[] {
  return getAllEvents().filter((e) => e.nodeSlug === "global");
}

/**
 * Seed events for a single node (used when API returns no events for that node).
 * Berlin coworking and other in-code events are not in the Sheet; this prevents
 * the Berlin/SF programming pages from showing empty when Sheet/Luma have no rows for that node.
 */
export function getSeedEventsByNode(slug: NodeSlug): NodeEvent[] {
  return getSeedEvents().filter((e) => e.nodeSlug === slug);
}

/**
 * Events to show on a node's programming page. Uses API (Sheet + Luma) when present;
 * if the API has no events for this node, falls back to seed events so Berlin coworking
 * and other in-code events still appear.
 */
export function getEventsByNodeForDisplay(
  slug: NodeSlug,
  dynamicEvents: NodeEvent[] | null,
): NodeEvent[] {
  if (dynamicEvents && dynamicEvents.length > 0) {
    const forNode = dynamicEvents.filter((e) => e.nodeSlug === slug);
    if (forNode.length > 0) return forNode;
  }
  return getSeedEventsByNode(slug);
}

export function getEventById(id: string): NodeEvent | undefined {
  return getAllEvents().find((e) => e.id === id);
}
