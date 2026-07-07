"use strict";

/**
 * Shared loader for Luma RSVP enrichment — sheet RSVPs + merged events + email index.
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
 * @param {Array} [sheetRsvps] - When omitted, loads latest RSVPs from the sheet.
 */
async function enrichRsvpsForApi(sheetRsvps) {
  const [records, database] = await Promise.all([
    loadEmailMatchRecords(),
    sheetRsvps ? Promise.resolve(null) : getFullDatabaseFromSheet(),
  ]);

  let rsvps = sheetRsvps;
  let events = [];
  if (database) {
    rsvps = database.rsvps || [];
    events = database.events || [];
  } else {
    const full = await getFullDatabaseFromSheet();
    events = full.events || [];
  }

  events = await mergeSheetEventsWithLuma(events);
  return enrichRsvpsWithLumaGuests(rsvps, events, records);
}

module.exports = {
  enrichRsvpsForApi,
};
