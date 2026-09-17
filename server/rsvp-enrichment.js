"use strict";

/**
 * Shared loader for Luma RSVP enrichment — sheet RSVPs + merged events + email index.
 *
 * Callers that already loaded the database (GET /api/database) MUST pass
 * `{ events, records }` so we do not re-hit Google Sheets. A previous bug
 * re-fetched the full sheet here and blew past Sheets read quotas.
 */

const { getFullDatabaseFromSheet } = require("./sheet-database");
const { loadRealDataRecords } = require("./realdata-store");
const { mergeSheetEventsWithLuma } = require("./luma-merge");
const { enrichRsvpsWithLumaGuests } = require("./luma-guests");
const { isLocalMockMode, getLocalDatabase } = require("./local-storage");

async function loadEmailMatchRecords() {
  try {
    const loaded = await loadRealDataRecords({ write: false });
    return loaded.records || [];
  } catch (err) {
    if (!isLocalMockMode()) throw err;
    const db = await getLocalDatabase();
    return (db.people || []).map((person) => ({ person }));
  }
}

/**
 * @param {Array|null|undefined} sheetRsvps - Latest Atlas RSVPs (or omit to load)
 * @param {{ events?: Array, records?: Array, skipEventMerge?: boolean }} [options]
 */
async function enrichRsvpsForApi(sheetRsvps, options = {}) {
  let rsvps = Array.isArray(sheetRsvps) ? sheetRsvps : null;
  let events = options.events;
  let records = options.records;

  if (rsvps == null || events == null) {
    const database = await getFullDatabaseFromSheet();
    rsvps = rsvps ?? database.rsvps ?? [];
    events = events ?? database.events ?? [];
    records = records ?? database._rosterRecords;
  }

  if (!records) {
    records = await loadEmailMatchRecords();
  }

  if (!options.skipEventMerge) {
    events = await mergeSheetEventsWithLuma(events || []);
  }

  return enrichRsvpsWithLumaGuests(rsvps || [], events || [], records || []);
}

module.exports = {
  enrichRsvpsForApi,
  loadEmailMatchRecords,
};
