"use strict";

/**
 * Sheet rows that duplicated the July 2026 Berlin flagship workshop under wrong
 * titles/ids. The Events tab may still contain these until someone edits the
 * sheet — we normalize at read time so the app, RSVP summaries, and deploy-time
 * events.json stay aligned with the public workshop page.
 *
 * @see https://foresight.org/events/2026-secure-sovereign-ai-workshop/
 */

const SECURE_SOVEREIGN_AI_WORKSHOP_URL =
  "https://foresight.org/events/2026-secure-sovereign-ai-workshop/";

const SECURE_SOVEREIGN_AI_WORKSHOP_CANONICAL_ID =
  "berlin-secure-sovereign-ai-2026-07-18";

/** @type {ReadonlySet<string>} */
const LEGACY_BERLIN_JULY_SECURE_WORKSHOP_EVENT_IDS = new Set([
  "berlin-ai-science-2026-07-18",
  "workshop-ai-for-ai-berlin-2026-07-17",
]);

const LEGACY_TO_CANONICAL_EVENT_ID = {
  "berlin-ai-science-2026-07-18": SECURE_SOVEREIGN_AI_WORKSHOP_CANONICAL_ID,
  "workshop-ai-for-ai-berlin-2026-07-17": SECURE_SOVEREIGN_AI_WORKSHOP_CANONICAL_ID,
};

const SECURE_SOVEREIGN_AI_WORKSHOP_TITLE = "Secure & Sovereign AI Workshop";

const SECURE_SOVEREIGN_AI_WORKSHOP_DESCRIPTION =
  "A Foresight flagship workshop at the Berlin Node on making AI an engine of defense in a multipolar human–AI world. ~80 researchers, engineers, cryptographers, security practitioners and funders work across three tracks — AI for Secure AI (self-improving defenses, formal proofs, red-teaming), AI for Private AI (confidential compute, encrypted data pipelines, distributed trust), and AI for Decentralized & Cooperative AI (multi-agent coordination, mechanism design, game theory). Short talks, unconference-style working groups, mentorship hours and sponsor gatherings; projects incubated here are eligible for Foresight grants, and residents may stay on to keep sprinting at the Berlin Node. Held under Chatham House Rule. Full details and application: https://foresight.org/events/2026-secure-sovereign-ai-workshop/";

/**
 * Canonical sheet-shaped event (matches {@link rowToEvent} output in sheet-database).
 */
function canonicalBerlinSecureSovereignAiJuly2026() {
  return {
    id: SECURE_SOVEREIGN_AI_WORKSHOP_CANONICAL_ID,
    nodeSlug: "berlin",
    title: SECURE_SOVEREIGN_AI_WORKSHOP_TITLE,
    description: SECURE_SOVEREIGN_AI_WORKSHOP_DESCRIPTION,
    location: "Berlin, Germany",
    startAt: "2026-07-18T09:00:00+02:00",
    endAt: "2026-07-19T18:00:00+02:00",
    type: "workshop",
    tags: ["workshop", "ai", "secure-ai", "privacy", "decentralized", "flagship"],
    visibility: "public",
    capacity: 80,
    externalLink: SECURE_SOVEREIGN_AI_WORKSHOP_URL,
    coverImageUrl: null,
    recurrenceGroupId: null,
    _lumaEventId: null,
  };
}

/**
 * Drop legacy duplicate rows; inject the canonical workshop if the sheet does
 * not already define it (by id or official external link).
 *
 * @param {Array<Record<string, unknown>>} events
 * @returns {Array<Record<string, unknown>>}
 */
function applyBerlinSecureWorkshopSheetOverrides(events) {
  if (!Array.isArray(events)) return [];
  const filtered = events.filter(
    (e) => e && !LEGACY_BERLIN_JULY_SECURE_WORKSHOP_EVENT_IDS.has(String(e.id)),
  );
  const hasCanonical = filtered.some((e) => {
    if (!e) return false;
    if (String(e.id) === SECURE_SOVEREIGN_AI_WORKSHOP_CANONICAL_ID) return true;
    const link = e.externalLink != null ? String(e.externalLink).trim() : "";
    return link === SECURE_SOVEREIGN_AI_WORKSHOP_URL;
  });
  if (!hasCanonical) filtered.push(canonicalBerlinSecureSovereignAiJuly2026());
  return filtered;
}

/**
 * @param {Array<{ eventId?: string; updatedAt?: string } & Record<string, unknown>>} rsvps
 * @returns {Array<Record<string, unknown>>}
 */
function remapBerlinSecureWorkshopRsvpEventIds(rsvps) {
  if (!Array.isArray(rsvps)) return [];
  return rsvps.map((r) => {
    if (!r || !r.eventId) return r;
    const nextId = LEGACY_TO_CANONICAL_EVENT_ID[String(r.eventId)];
    if (!nextId) return r;
    const title =
      typeof r.eventTitle === "string" && r.eventTitle.trim()
        ? r.eventTitle
        : SECURE_SOVEREIGN_AI_WORKSHOP_TITLE;
    return { ...r, eventId: nextId, eventTitle: title };
  });
}

/**
 * Latest row wins per (eventId, personId) — same semantics as sheet RSVP parsing.
 *
 * @param {Array<{ eventId?: string; personId?: string; updatedAt?: string } & Record<string, unknown>>} rsvps
 * @returns {Array<Record<string, unknown>>}
 */
function dedupeRsvpsByEventAndPerson(rsvps) {
  const byKey = new Map();
  for (const r of rsvps) {
    if (!r || !r.eventId || !r.personId) continue;
    const key = `${String(r.eventId)}\t${String(r.personId)}`;
    const existing = byKey.get(key);
    if (
      !existing ||
      new Date(String(r.updatedAt || 0)) > new Date(String(existing.updatedAt || 0))
    ) {
      byKey.set(key, r);
    }
  }
  return Array.from(byKey.values());
}

/**
 * @param {Array<Record<string, unknown>>} rsvps
 * @returns {Array<Record<string, unknown>>}
 */
function normalizeBerlinSecureWorkshopRsvps(rsvps) {
  return dedupeRsvpsByEventAndPerson(remapBerlinSecureWorkshopRsvpEventIds(rsvps));
}

module.exports = {
  SECURE_SOVEREIGN_AI_WORKSHOP_URL,
  SECURE_SOVEREIGN_AI_WORKSHOP_CANONICAL_ID,
  LEGACY_BERLIN_JULY_SECURE_WORKSHOP_EVENT_IDS,
  applyBerlinSecureWorkshopSheetOverrides,
  normalizeBerlinSecureWorkshopRsvps,
  remapBerlinSecureWorkshopRsvpEventIds,
  dedupeRsvpsByEventAndPerson,
};
