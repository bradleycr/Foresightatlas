"use strict";

/**
 * Aggregate community engagement from the CheckIns + RSVPs sheet tabs.
 *
 * Nanowheel rules (match src/services/nanowheels.ts):
 *   • +1 per active check-in (latest row per person × node × day, not withdrawn)
 *   • +1 per RSVP with status "going" (latest row per person × event)
 *
 * Going RSVPs include Luma-approved guests matched to the directory (same merge
 * as GET /api/rsvps). Luma supersedes Atlas for the same person × event so
 * nanowheels never double-count.
 */

const { google } = require("googleapis");
const { getSpreadsheetId, SHEET_NAMES } = require("../scripts/sheet-schema");
const { normalizeBerlinSecureWorkshopRsvps } = require("./event-corrections");
const { loadRealDataRecords } = require("./realdata-store");
const { mergeSheetEventsWithLuma } = require("./luma-merge");
const { enrichRsvpsWithLumaGuests } = require("./luma-guests");
const { buildGeographyStats } = require("./geo-continents");
const { countActiveConnections } = require("./connections-store");
const { loadLoginStats } = require("./login-events");
const { parseRoleTypes } = require("./role-types");

const SPREADSHEET_ID = getSpreadsheetId();
const NODE_SLUGS = ["berlin", "sf", "global"];
const NODE_LABELS = {
  berlin: "Berlin Node",
  sf: "SF Node",
  global: "Global",
};

async function getSheetsClientForRead() {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey) {
    const auth = new google.auth.GoogleAuth({ apiKey });
    return google.sheets({ version: "v4", auth });
  }
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let key = null;
  if (keyJson) {
    try {
      key = JSON.parse(keyJson);
    } catch {
      return null;
    }
  } else if (keyPath) {
    const fs = require("fs");
    const path = require("path");
    const resolved = path.resolve(keyPath);
    if (fs.existsSync(resolved)) {
      try {
        key = JSON.parse(fs.readFileSync(resolved, "utf8"));
      } catch {
        return null;
      }
    }
  }
  if (!key) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

function parseCheckInRows(values) {
  if (!values || values.length < 2) return [];
  const [headerRow, ...rows] = values;
  const col = (name) =>
    headerRow.findIndex((c) => String(c).trim().toLowerCase() === name.toLowerCase());

  return rows
    .map((row) => {
      const personId = String(row[col("personId")] ?? "").trim();
      const nodeSlug = String(row[col("nodeSlug")] ?? "").trim();
      const date = String(row[col("date")] ?? "").trim();
      if (!personId || !nodeSlug || !date) return null;
      return {
        personId,
        fullName: String(row[col("fullName")] ?? "").trim(),
        nodeSlug,
        date,
        type: String(row[col("type")] ?? "checkin").trim() || "checkin",
        createdAt: String(row[col("createdAt")] ?? "").trim() || new Date().toISOString(),
        updatedAt: String(row[col("updatedAt")] ?? "").trim() || new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

function collapseCheckIns(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.personId}\t${row.nodeSlug}\t${row.date}`;
    const existing = byKey.get(key);
    if (!existing || new Date(row.updatedAt) > new Date(existing.updatedAt)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()].filter((r) => r.type !== "withdrawn");
}

function parseRsvpRows(values) {
  if (!values || values.length < 2) return [];
  const [headerRow, ...rows] = values;
  const col = (name) =>
    headerRow.findIndex((c) => String(c).trim().toLowerCase() === name.toLowerCase());

  const allRows = rows
    .map((row) => {
      const eventId = String(row[col("eventId")] ?? "").trim();
      const personId = String(row[col("personId")] ?? "").trim();
      if (!eventId || !personId) return null;
      const status = String(row[col("status")] ?? "going").trim() || "going";
      return {
        eventId,
        eventTitle: String(row[col("eventTitle")] ?? "").trim(),
        personId,
        fullName: String(row[col("fullName")] ?? "").trim(),
        status,
        createdAt: String(row[col("createdAt")] ?? "").trim() || new Date().toISOString(),
        updatedAt: String(row[col("updatedAt")] ?? "").trim() || new Date().toISOString(),
      };
    })
    .filter(Boolean);

  const byKey = new Map();
  for (const row of allRows) {
    const key = `${row.eventId}\t${row.personId}`;
    const existing = byKey.get(key);
    if (!existing || new Date(row.updatedAt) > new Date(existing.updatedAt)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

function parseEventRows(values) {
  if (!values || values.length < 2) return new Map();
  const [headerRow, ...rows] = values;
  const col = (name) =>
    headerRow.findIndex((c) => String(c).trim().toLowerCase() === name.toLowerCase());

  const map = new Map();
  for (const row of rows) {
    const id = String(row[col("id")] ?? "").trim();
    if (!id) continue;
    map.set(id, {
      id,
      nodeSlug: String(row[col("nodeSlug")] ?? "global").trim() || "global",
      title: String(row[col("title")] ?? "").trim(),
      type: String(row[col("type")] ?? "").trim(),
      startAt: String(row[col("startAt")] ?? "").trim(),
      endAt: String(row[col("endAt")] ?? "").trim(),
      lumaEventId: String(row[col("lumaEventId")] ?? "").trim() || null,
    });
  }
  return map;
}

function inferEventMeta(eventId, eventTitle, sheetEvent) {
  if (sheetEvent) {
    const type = sheetEvent.type || "";
    const title = sheetEvent.title || eventTitle || "";
    return {
      nodeSlug: normalizeNodeSlug(sheetEvent.nodeSlug),
      title: title || eventTitle || eventId,
      type,
      isCoworking: type === "coworking" || isCoworkingLike(eventId, title),
    };
  }

  const id = String(eventId || "");
  const title = String(eventTitle || "");
  const blob = `${id} ${title}`.toLowerCase();
  let nodeSlug = "global";
  if (id.startsWith("berlin-") || blob.includes("berlin-coworking")) nodeSlug = "berlin";
  else if (id.startsWith("sf-") || blob.includes("-sf-") || blob.includes("san francisco")) {
    nodeSlug = "sf";
  } else if (blob.includes("berlin")) nodeSlug = "berlin";
  else if (/\bsf\b|bay area/.test(blob)) nodeSlug = "sf";

  return {
    nodeSlug: normalizeNodeSlug(nodeSlug),
    title: title || eventId,
    type: isCoworkingLike(id, title) ? "coworking" : "other",
    isCoworking: isCoworkingLike(id, title),
  };
}

function normalizeNodeSlug(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "berlin" || s === "berlin node") return "berlin";
  if (s === "sf" || s === "bay area" || s === "bay area node") return "sf";
  return "global";
}

function isCoworkingLike(eventId, title) {
  const blob = `${eventId} ${title}`.toLowerCase();
  return /coworking|resident'?s day|residency day|residence day/.test(blob);
}

function monthKey(isoOrDate) {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function emptyNodeStats(slug) {
  return {
    nodeSlug: slug,
    label: NODE_LABELS[slug] || slug,
    nanowheels: 0,
    checkIns: 0,
    rsvpsGoing: 0,
    coworkingEngagements: 0,
    uniqueParticipants: 0,
    uniqueCheckInPeople: 0,
    uniqueRsvpPeople: 0,
  };
}

function effectiveIsAlumni(person, referenceYear = new Date().getFullYear()) {
  if (!person) return false;
  if (person.isAlumni) return true;
  if (person.fellowshipEndYear != null && person.fellowshipEndYear < referenceYear) return true;
  if (person.fellowshipCohortYear >= 1900 && person.fellowshipCohortYear < referenceYear) return true;
  return false;
}

function normalizePrimaryNode(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s.includes("berlin")) return "berlin";
  if (s.includes("sf") || s.includes("san francisco") || s.includes("bay area")) return "sf";
  return "global";
}

function isOpenToMeetPerson(person) {
  const url = String(person?.availabilityUrl || "").trim();
  return Boolean(url && /^https?:\/\/[^\s]+$/i.test(url) && url.length <= 220);
}

function hasMapLocation(person) {
  if (String(person?.currentCity || "").trim()) return true;
  const lat = person?.currentCoordinates?.lat;
  const lng = person?.currentCoordinates?.lng;
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

function isClaimedRecord(record) {
  return Boolean(record?.auth?.claimedAt || record?.auth?.passwordHash);
}

function personEmail(person) {
  return String(person?.email || person?.calendarEmail || "").trim();
}

function startOfUtcDayMs(d = new Date()) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function countCheckInsInDays(checkIns, days) {
  const since = startOfUtcDayMs() - (days - 1) * 24 * 60 * 60 * 1000;
  return checkIns.filter((c) => {
    const t = new Date(c.date).getTime();
    return Number.isFinite(t) && t >= since;
  }).length;
}

function buildCheckInWindows(checkIns) {
  const byNode = Object.fromEntries(
    NODE_SLUGS.map((slug) => [
      slug,
      {
        nodeSlug: slug,
        label: NODE_LABELS[slug],
        last7Days: 0,
        last30Days: 0,
        allTime: 0,
      },
    ]),
  );
  const since7 = startOfUtcDayMs() - 6 * 24 * 60 * 60 * 1000;
  const since30 = startOfUtcDayMs() - 29 * 24 * 60 * 60 * 1000;

  for (const c of checkIns) {
    const slug = normalizeNodeSlug(c.nodeSlug);
    if (!byNode[slug]) continue;
    byNode[slug].allTime += 1;
    const t = new Date(c.date).getTime();
    if (!Number.isFinite(t)) continue;
    if (t >= since7) byNode[slug].last7Days += 1;
    if (t >= since30) byNode[slug].last30Days += 1;
  }

  return {
    last7Days: countCheckInsInDays(checkIns, 7),
    last30Days: countCheckInsInDays(checkIns, 30),
    allTime: checkIns.length,
    byNode: NODE_SLUGS.map((s) => byNode[s]),
  };
}

function buildRsvpSourceSplit(rsvpsGoing) {
  let atlas = 0;
  let luma = 0;
  for (const r of rsvpsGoing) {
    if (String(r.source || "").toLowerCase() === "luma") luma += 1;
    else atlas += 1;
  }
  return {
    atlas,
    luma,
    total: atlas + luma,
  };
}

/**
 * Unclaimed roster rows that have an email — for reminder CSV download.
 * Never includes password hashes or tokens.
 */
function buildUnclaimedWithEmail(records) {
  const rows = [];
  for (const record of records || []) {
    const person = record?.person;
    if (!person?.fullName) continue;
    if (isClaimedRecord(record)) continue;
    const email = personEmail(person);
    if (!email || !email.includes("@")) continue;
    const roles = Array.isArray(person.roleTypes) && person.roleTypes.length
      ? person.roleTypes
      : parseRoleTypes(person.roleType);
    rows.push({
      fullName: person.fullName,
      email,
      roleType: roles[0] || String(person.roleType || "").trim() || "",
      primaryNode: String(person.primaryNode || "").trim(),
      personId: person.id || "",
    });
  }
  rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return rows;
}

function buildClaimFunnel(rosterRecords) {
  const unclaimedWithEmail = buildUnclaimedWithEmail(rosterRecords);
  let claimed = 0;
  let unclaimed = 0;
  let unclaimedNoEmail = 0;
  const since30 = startOfUtcDayMs() - 29 * 24 * 60 * 60 * 1000;
  let claimedLast30Days = 0;

  for (const record of rosterRecords || []) {
    if (!record?.person?.fullName) continue;
    if (isClaimedRecord(record)) {
      claimed += 1;
      const at = String(record?.auth?.claimedAt || "").trim();
      if (at) {
        const t = new Date(at).getTime();
        if (Number.isFinite(t) && t >= since30) claimedLast30Days += 1;
      }
    } else {
      unclaimed += 1;
      const email = personEmail(record.person);
      if (!email || !email.includes("@")) unclaimedNoEmail += 1;
    }
  }

  return {
    claimed,
    unclaimed,
    unclaimedWithEmail: unclaimedWithEmail.length,
    unclaimedNoEmail,
    claimedLast30Days,
    reminderList: unclaimedWithEmail,
  };
}

function todayDateKeyUtc() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function isUpcomingEvent(event) {
  if (!event) return false;
  const anchor = event.endAt || event.startAt;
  if (!anchor) return false;
  const endMs = new Date(anchor).getTime();
  if (Number.isNaN(endMs)) return false;
  const startOfTodayUtc = Date.parse(`${todayDateKeyUtc()}T00:00:00.000Z`);
  return endMs >= startOfTodayUtc;
}

function parseTravelWindowRows(values) {
  if (!values || values.length < 2) return [];
  const [headerRow, ...rows] = values;
  const col = (name) =>
    headerRow.findIndex((c) => String(c).trim().toLowerCase() === name.toLowerCase());

  return rows
    .map((row) => {
      const personId = String(row[col("personId")] ?? "").trim();
      const endDate = String(row[col("endDate")] ?? "").trim();
      if (!personId || !endDate) return null;
      return { personId, endDate };
    })
    .filter(Boolean);
}

function countActiveTravelWindows(rows) {
  const today = todayDateKeyUtc();
  return rows.filter((row) => row.endDate >= today).length;
}

function buildRosterStats(records) {
  const refYear = new Date().getFullYear();
  const byPrimaryNode = Object.fromEntries(NODE_SLUGS.map((s) => [s, 0]));
  let total = 0;
  let publicProfiles = 0;
  let claimed = 0;
  let onMap = 0;
  let withPhoto = 0;
  let openToMeet = 0;
  let withContact = 0;
  let alumni = 0;
  let current = 0;

  for (const record of records) {
    const person = record?.person;
    if (!person?.fullName) continue;
    total += 1;
    if (!person.isPrivate) publicProfiles += 1;
    if (isClaimedRecord(record)) claimed += 1;
    if (hasMapLocation(person)) onMap += 1;
    if (person.profileImageUrl) withPhoto += 1;
    if (isOpenToMeetPerson(person)) openToMeet += 1;
    if (person.contactUrlOrHandle || person.calendarEmail) withContact += 1;
    if (effectiveIsAlumni(person, refYear)) alumni += 1;
    else current += 1;
    const node = normalizePrimaryNode(person.primaryNode);
    if (byPrimaryNode[node] != null) byPrimaryNode[node] += 1;
  }

  return {
    total,
    publicProfiles,
    claimed,
    unclaimed: Math.max(0, total - claimed),
    onMap,
    withoutLocation: Math.max(0, total - onMap),
    withPhoto,
    openToMeet,
    withContact,
    alumni,
    current,
    byPrimaryNode: NODE_SLUGS.map((slug) => ({
      nodeSlug: slug,
      label: NODE_LABELS[slug],
      count: byPrimaryNode[slug] || 0,
    })),
  };
}

function buildTopParticipants({ checkIns, rsvpsGoing, nameByPersonId }) {
  const tally = new Map();

  const bump = (personId, field, fullName) => {
    if (!personId) return;
    const row = tally.get(personId) || {
      personId,
      fullName: nameByPersonId.get(personId) || fullName || personId,
      nanowheels: 0,
      checkIns: 0,
      rsvpsGoing: 0,
    };
    if (fullName && !nameByPersonId.has(personId)) row.fullName = fullName;
    row[field] += 1;
    row.nanowheels += 1;
    tally.set(personId, row);
  };

  for (const c of checkIns) bump(c.personId, "checkIns", c.fullName);
  for (const r of rsvpsGoing) bump(r.personId, "rsvpsGoing", r.fullName);

  return [...tally.values()]
    .sort((a, b) => b.nanowheels - a.nanowheels || a.fullName.localeCompare(b.fullName))
    .slice(0, 10);
}

function buildCommunityStats({
  checkIns,
  rsvpsGoing,
  rsvpsInterested,
  eventMetaMap,
  rosterRecords,
  travelWindowRows,
  connections,
  logins,
}) {
  const byNode = Object.fromEntries(NODE_SLUGS.map((s) => [s, emptyNodeStats(s)]));
  const participantSets = Object.fromEntries(NODE_SLUGS.map((s) => [s, new Set()]));
  const allParticipants = new Set();

  const monthlyMap = new Map();
  const bumpMonth = (key, field) => {
    if (!key) return;
    const row = monthlyMap.get(key) || {
      month: key,
      checkIns: 0,
      rsvpsGoing: 0,
      nanowheels: 0,
    };
    row[field] += 1;
    row.nanowheels += 1;
    monthlyMap.set(key, row);
  };

  for (const c of checkIns) {
    const slug = normalizeNodeSlug(c.nodeSlug);
    if (!byNode[slug]) continue;
    byNode[slug].checkIns += 1;
    byNode[slug].nanowheels += 1;
    participantSets[slug].add(c.personId);
    allParticipants.add(c.personId);
    bumpMonth(monthKey(c.date), "checkIns");
  }

  const eventGoingCounts = new Map();
  const upcomingEventIds = new Set();
  for (const [eventId, event] of eventMetaMap.entries()) {
    if (isUpcomingEvent(event)) upcomingEventIds.add(eventId);
  }

  let upcomingGoingRsvps = 0;
  for (const r of rsvpsGoing) {
    const meta = inferEventMeta(r.eventId, r.eventTitle, eventMetaMap.get(r.eventId));
    const slug = meta.nodeSlug;
    if (!byNode[slug]) continue;
    byNode[slug].rsvpsGoing += 1;
    byNode[slug].nanowheels += 1;
    if (meta.isCoworking) byNode[slug].coworkingEngagements += 1;
    participantSets[slug].add(r.personId);
    allParticipants.add(r.personId);
    bumpMonth(monthKey(r.createdAt), "rsvpsGoing");
    if (upcomingEventIds.has(r.eventId)) upcomingGoingRsvps += 1;

    const ek = r.eventId;
    const prev = eventGoingCounts.get(ek) || {
      eventId: ek,
      title: meta.title,
      nodeSlug: slug,
      going: 0,
      isCoworking: meta.isCoworking,
    };
    prev.going += 1;
    eventGoingCounts.set(ek, prev);
  }

  for (const slug of NODE_SLUGS) {
    byNode[slug].uniqueParticipants = participantSets[slug].size;
  }

  const totals = {
    nanowheels: checkIns.length + rsvpsGoing.length,
    checkIns: checkIns.length,
    rsvpsGoing: rsvpsGoing.length,
    rsvpsInterested: rsvpsInterested.length,
    uniqueParticipants: allParticipants.size,
    coworkingEngagements: rsvpsGoing.filter((r) => {
      const meta = inferEventMeta(r.eventId, r.eventTitle, eventMetaMap.get(r.eventId));
      return meta.isCoworking;
    }).length,
    eventsWithGoing: eventGoingCounts.size,
    upcomingEvents: upcomingEventIds.size,
    upcomingGoingRsvps,
    activeTravelWindows: countActiveTravelWindows(travelWindowRows),
  };

  const monthly = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month));
  const thisMonthKey = monthKey(new Date());
  const thisMonthRow = monthlyMap.get(thisMonthKey) || {
    month: thisMonthKey,
    checkIns: 0,
    rsvpsGoing: 0,
    nanowheels: 0,
  };

  const checkInWindows = buildCheckInWindows(checkIns);

  const topEvents = [...eventGoingCounts.values()]
    .sort((a, b) => b.going - a.going)
    .slice(0, 12);

  const nameByPersonId = new Map(
    (rosterRecords || []).map((r) => [r.person?.id, r.person?.fullName]).filter(([id]) => id),
  );
  const topParticipants = buildTopParticipants({ checkIns, rsvpsGoing, nameByPersonId });

  const roster = buildRosterStats(rosterRecords || []);
  const claims = buildClaimFunnel(rosterRecords || []);
  const geography = buildGeographyStats(rosterRecords || []);
  const rsvpSources = buildRsvpSourceSplit(rsvpsGoing);

  return {
    generatedAt: new Date().toISOString(),
    totals,
    roster,
    claims,
    geography,
    rsvpSources,
    checkIns: checkInWindows,
    connections: connections || { activeEdges: 0, activeBookmarks: 0 },
    logins: logins || null,
    visits: {
      /**
       * Web Analytics is enabled on the Vercel project + @vercel/analytics is
       * in the app. Historical pageviews before enablement are empty (0).
       * Query via: vercel api /v1/query/web-analytics/visits/count?projectId=…
       */
      available: true,
      reason: "collecting",
      hint: "Pageviews start from Web Analytics enablement — nothing recoverable before that.",
      pageviews: null,
      visitors: null,
    },
    thisMonth: {
      month: thisMonthKey,
      nanowheels: thisMonthRow.nanowheels,
      checkIns: thisMonthRow.checkIns,
      rsvpsGoing: thisMonthRow.rsvpsGoing,
    },
    activity: {
      checkInsLast7Days: checkInWindows.last7Days,
      checkInsLast30Days: checkInWindows.last30Days,
      avgNanowheelsPerParticipant:
        totals.uniqueParticipants > 0
          ? Math.round((totals.nanowheels / totals.uniqueParticipants) * 10) / 10
          : 0,
    },
    byNode: NODE_SLUGS.map((s) => byNode[s]),
    monthly,
    topEvents,
    topParticipants,
  };
}

async function loadCommunityStatsFromSheet() {
  const sheets = await getSheetsClientForRead();
  if (!sheets) {
    throw new Error("Sheet credentials not configured.");
  }

  let checkInValues = [];
  let rsvpValues = [];
  let eventValues = [];
  let travelValues = [];

  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'CheckIns'!A:G`,
    });
    checkInValues = data.values || [];
  } catch {
    checkInValues = [];
  }

  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAMES.RSVPS}'!A:G`,
    });
    rsvpValues = data.values || [];
  } catch {
    rsvpValues = [];
  }

  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAMES.EVENTS}'!A:O`,
    });
    eventValues = data.values || [];
  } catch {
    eventValues = [];
  }

  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAMES.TRAVEL_WINDOWS}'!A:K`,
    });
    travelValues = data.values || [];
  } catch {
    travelValues = [];
  }

  let rosterRecords = [];
  try {
    const loaded = await loadRealDataRecords();
    rosterRecords = loaded.records || [];
  } catch {
    rosterRecords = [];
  }

  const checkIns = collapseCheckIns(parseCheckInRows(checkInValues));
  const sheetRsvps = normalizeBerlinSecureWorkshopRsvps(parseRsvpRows(rsvpValues));
  const eventMetaMap = parseEventRows(eventValues);
  const travelWindowRows = parseTravelWindowRows(travelValues);

  // Same Luma guest merge as programming pages — Luma wins, one going per person×event.
  const sheetEvents = [...eventMetaMap.values()].map((meta) => ({
    id: meta.id,
    title: meta.title,
    nodeSlug: meta.nodeSlug,
    startAt: meta.startAt || null,
    endAt: meta.endAt || null,
    lumaEventId: meta.lumaEventId || null,
    type: meta.type || null,
  }));
  let latestRsvps = sheetRsvps;
  try {
    const mergedEvents = await mergeSheetEventsWithLuma(sheetEvents);
    latestRsvps = await enrichRsvpsWithLumaGuests(sheetRsvps, mergedEvents, rosterRecords);
  } catch (err) {
    console.warn(
      "[community-stats] Luma RSVP enrichment skipped:",
      err?.message || err,
    );
  }

  const rsvpsGoing = latestRsvps.filter((r) => r.status === "going");
  const rsvpsInterested = latestRsvps.filter((r) => r.status === "interested");

  let connections = { activeEdges: 0, activeBookmarks: 0 };
  try {
    connections = await countActiveConnections();
  } catch (err) {
    console.warn("[community-stats] connections skipped:", err?.message || err);
  }

  const logins = await loadLoginStats();

  return buildCommunityStats({
    checkIns,
    rsvpsGoing,
    rsvpsInterested,
    eventMetaMap,
    rosterRecords,
    travelWindowRows,
    connections,
    logins,
  });
}

module.exports = {
  buildCommunityStats,
  buildRosterStats,
  buildClaimFunnel,
  buildUnclaimedWithEmail,
  collapseCheckIns,
  inferEventMeta,
  loadCommunityStatsFromSheet,
};
