/**
 * Seed events for all nodes.
 *
 * Used only when the Google Sheet Events tab is empty/unavailable or when
 * merging with events.json (e.g. static build). Sheet is the source of truth
 * when GET /api/database returns events.
 */

import { NodeEvent, EventType, NodeSlug } from "../types/events";
import { fetchSheetEvents } from "../services/database";

/* ── helpers ────────────────────────────────────────────────────────── */

function eid(node: NodeSlug, slug: string, date: string): string {
  return `${node}-${slug}-${date}`.replace(/\s+/g, "-").toLowerCase();
}

/* ── Berlin public-holiday calendar (for skipping coworking) ───────── */

/**
 * Compute Easter Sunday (Gregorian) via the Meeus/Jones/Butcher algorithm.
 * Returned as a UTC-anchored Date at 00:00 to simplify day arithmetic.
 */
function easterSundayUTC(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysUTC(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Official Berlin public holidays (gesetzliche Feiertage) for a given year.
 *
 * Includes federal holidays plus Berlin's state-specific International
 * Women's Day (8 March). Returns YYYY-MM-DD strings so callers can
 * skip these dates from recurring schedules like the coworking Thursdays.
 */
function berlinPublicHolidays(year: number): Set<string> {
  const easter = easterSundayUTC(year);
  const fixed = (m: number, d: number): string =>
    ymd(new Date(Date.UTC(year, m - 1, d)));
  return new Set<string>([
    fixed(1, 1),                       // Neujahr
    fixed(3, 8),                       // Internationaler Frauentag (Berlin)
    ymd(addDaysUTC(easter, -2)),       // Karfreitag
    ymd(addDaysUTC(easter, 1)),        // Ostermontag
    fixed(5, 1),                       // Tag der Arbeit
    ymd(addDaysUTC(easter, 39)),       // Christi Himmelfahrt
    ymd(addDaysUTC(easter, 50)),       // Pfingstmontag
    fixed(10, 3),                      // Tag der Deutschen Einheit
    fixed(12, 25),                     // 1. Weihnachtsfeiertag
    fixed(12, 26),                     // 2. Weihnachtsfeiertag
  ]);
}

/** Berlin's DST switch: +02:00 (CEST) from last Sun of March to last Sun of October, else +01:00 (CET). */
function berlinOffset(dateISO: string): "+01:00" | "+02:00" {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const year = d.getUTCFullYear();
  const lastSundayUTC = (month: number) => {
    const last = new Date(Date.UTC(year, month + 1, 0));
    last.setUTCDate(last.getUTCDate() - last.getUTCDay());
    return last;
  };
  const dstStart = lastSundayUTC(2);   // March
  const dstEnd = lastSundayUTC(9);     // October
  return d >= dstStart && d < dstEnd ? "+02:00" : "+01:00";
}

/** Every Thursday in [start, end] that is NOT a Berlin public holiday. */
function nonHolidayThursdays(start: Date, end: Date): Date[] {
  const holidaysByYear = new Map<number, Set<string>>();
  const getHolidays = (year: number) => {
    let set = holidaysByYear.get(year);
    if (!set) {
      set = berlinPublicHolidays(year);
      holidaysByYear.set(year, set);
    }
    return set;
  };

  const result: Date[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  while (cur.getUTCDay() !== 4) cur.setUTCDate(cur.getUTCDate() + 1);
  while (cur <= end) {
    const iso = ymd(cur);
    if (!getHolidays(cur.getUTCFullYear()).has(iso)) {
      result.push(new Date(cur));
    }
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return result;
}

/* ── Berlin: recurring Coworking / Resident's Day ─────────────────────── */

/**
 * The Berlin Node hosts an open **Coworking / Resident's Day** every Thursday
 * that isn't a German public holiday. It's the one recurring event that lives
 * in code (not Luma), so we always inject it into the Berlin programming page
 * alongside anything coming from the Luma calendar.
 *
 * Schedule: 12:00–17:00 local (Berlin), using the correct CET/CEST offset
 * for that date so calendar apps and sorting behave correctly across the
 * DST boundary.
 */
function berlinWeeklyCoworking(
  start: Date = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)),
  end: Date = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 11, 31)),
): NodeEvent[] {
  return nonHolidayThursdays(start, end).map((d) => {
    const iso = ymd(d);
    const offset = berlinOffset(iso);
    return {
      id: eid("berlin", "coworking-residents-day", iso),
      nodeSlug: "berlin",
      title: "Coworking / Resident's Day",
      description:
        "Open coworking and resident's day at the Berlin Node. Drop in to work, meet residents and fellows, share lunch, and find collaborators. Every Thursday that isn't a German public holiday.",
      location: "Berlin Node",
      startAt: `${iso}T12:00:00${offset}`,
      endAt: `${iso}T17:00:00${offset}`,
      type: "coworking",
      tags: ["recurring", "open", "coworking", "residents-day"],
      visibility: "internal",
      capacity: null,
      externalLink: null,
      recurrenceGroupId: "berlin-coworking-residents-day",
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
/** Set when the last load fell back to seeds because GET /api/database failed. */
let _eventsSheetError: string | null = null;

export function getEventsSheetLoadError(): string | null {
  return _eventsSheetError;
}

/**
 * Load events: Google Sheet (GET /api/database) is the source of truth when it returns rows.
 * When the sheet has no events we use seeds. When the API fails, we use seeds and expose
 * {@link getEventsSheetLoadError} for UI.
 */
export async function loadEvents(): Promise<NodeEvent[]> {
  if (_dynamicLoaded && _cache) return _cache;

  const result = await fetchSheetEvents();
  if (result.ok && result.events.length > 0) {
    _cache = result.events.sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
    _eventsSheetError = null;
    _dynamicLoaded = true;
    return _cache;
  }

  _eventsSheetError = result.ok ? null : result.message;
  _dynamicLoaded = true;
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
 * Events to show on a node's programming page.
 *
 * Policy:
 *   • When the API (Sheet + Luma merge) returns events, those are authoritative
 *     for the node — with one important exception for Berlin.
 *   • Berlin's **Coworking / Resident's Day** lives only in this codebase (it's
 *     never published to Luma), so we always inject the generated Thursdays and
 *     deduplicate against any Luma row that lands on the same date with a
 *     coworking-like title. This guarantees coworking days never disappear
 *     just because Luma happens to have other Berlin events.
 *   • When the API has no events at all (offline / sheet outage), we fall back
 *     to the in-code seed set so the page is never empty.
 */
export function getEventsByNodeForDisplay(
  slug: NodeSlug,
  dynamicEvents: NodeEvent[] | null,
): NodeEvent[] {
  const apiHasRows = Array.isArray(dynamicEvents) && dynamicEvents.length > 0;
  const byStart = (a: NodeEvent, b: NodeEvent) =>
    new Date(a.startAt).getTime() - new Date(b.startAt).getTime();

  if (slug === "berlin") {
    const coworking = berlinWeeklyCoworking();
    if (apiHasRows) {
      const fromApi = dynamicEvents!.filter((e) => e.nodeSlug === "berlin");
      const apiCoworkingDates = new Set(
        fromApi
          .filter((e) => isCoworkingLike(e))
          .map((e) => e.startAt.slice(0, 10)),
      );
      const injected = coworking.filter(
        (c) => !apiCoworkingDates.has(c.startAt.slice(0, 10)),
      );
      return [...fromApi, ...injected].sort(byStart);
    }
    return getSeedEventsByNode("berlin");
  }

  if (apiHasRows) {
    const forNode = dynamicEvents!.filter((e) => e.nodeSlug === slug);
    if (forNode.length > 0) return forNode;
  }
  return getSeedEventsByNode(slug);
}

/** Heuristic: Luma events we'd consider the "same" as the seeded Coworking / Resident's Day. */
function isCoworkingLike(e: NodeEvent): boolean {
  if (e.type === "coworking") return true;
  const t = e.title.toLowerCase();
  return /coworking|resident'?s day|residency day|residence day/.test(t);
}

export function getEventById(id: string): NodeEvent | undefined {
  return getAllEvents().find((e) => e.id === id);
}
