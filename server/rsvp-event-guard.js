/**
 * Resolve a programming event and enforce "no RSVP after it ends".
 * Withdrawals are always allowed so people can clean up stale going/interested rows.
 */

const { getFullDatabaseFromSheet } = require("./sheet-database");
const { mergeSheetEventsWithLuma } = require("./luma-merge");
const { getLocalDatabase, isLocalMockMode } = require("./local-storage");
const { canWriteRsvpStatus } = require("./event-timing");

async function findProgrammingEvent(eventId) {
  const id = String(eventId || "").trim();
  if (!id) return null;

  if (isLocalMockMode()) {
    const db = await getLocalDatabase();
    const events = await mergeSheetEventsWithLuma(db.events || []);
    return events.find((e) => e && e.id === id) || null;
  }

  const database = await getFullDatabaseFromSheet();
  const events = await mergeSheetEventsWithLuma(database.events || []);
  return events.find((e) => e && e.id === id) || null;
}

/**
 * @param {string} eventId
 * @param {string} status
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
async function assertRsvpWriteAllowed(eventId, status) {
  const normalised = String(status || "").trim();
  if (normalised === "withdrawn") return { ok: true };

  try {
    const event = await findProgrammingEvent(eventId);
    return canWriteRsvpStatus(event, normalised);
  } catch (err) {
    // Lookup failure must not brick RSVP for the whole community; log and allow.
    console.warn(
      "RSVP past-event guard: event lookup failed:",
      err instanceof Error ? err.message : err,
    );
    return { ok: true };
  }
}

module.exports = {
  findProgrammingEvent,
  assertRsvpWriteAllowed,
};
