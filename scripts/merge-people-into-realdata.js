#!/usr/bin/env node
/**
 * Merge People tab → Real Data tab
 *
 * Copies focus tags, contact/email, short project tagline, and expanded
 * project description from the People tab into the Real Data tab where Real Data
 * is missing them. Matches rows by fullName (case-insensitive, normalized spaces).
 * Use this once to backfill Real Data from the legacy People tab; then use
 * Real Data as the single source of truth.
 *
 * Requires write access to the sheet (service account).
 * Env: SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS
 *
 *   node scripts/merge-people-into-realdata.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const {
  getSheetsClient,
  loadRealDataRecords,
  cloneRecord,
  upsertRealDataRecord,
  normalizeName,
  SPREADSHEET_ID,
} = require("../server/realdata-store");
const {
  SHEET_NAMES,
  PEOPLE_HEADERS,
  PEOPLE_SHEET_WIDTH,
} = require("./sheet-schema.js");

function parseJsonSafe(str, fallback) {
  if (str == null || String(str).trim() === "") return fallback;
  try {
    return JSON.parse(String(str));
  } catch {
    return fallback;
  }
}

function parseFocusTags(value) {
  if (value == null || String(value).trim() === "") return [];
  const s = String(value).trim();
  const parsed = parseJsonSafe(s, null);
  if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean);
  return s.split(",").map((t) => t.trim()).filter(Boolean);
}

function trim(value) {
  return value != null ? String(value).trim() : "";
}

/** Build a map: normalized fullName → { focusTags, contactUrlOrHandle, shortProjectTagline, expandedProjectDescription }.
 *  If multiple People rows share a name, keep the one with the most data. */
async function loadPeopleLookup(sheets) {
  const idx = (name) => PEOPLE_HEADERS.indexOf(name);
  let rows = [];
  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAMES.PEOPLE}'!A:${PEOPLE_SHEET_WIDTH}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    rows = data.values || [];
  } catch (err) {
    if (err.code === 400 && err.message?.includes("Unable to parse range")) {
      console.warn("People tab not found or empty.");
      return new Map();
    }
    throw err;
  }

  if (rows.length < 2) return new Map();

  const [headerRow, ...dataRows] = rows;
  const colIndex = {};
  PEOPLE_HEADERS.forEach((h, i) => {
    colIndex[h] = headerRow[i] === h ? i : headerRow.findIndex((c) => String(c).trim() === h);
  });

  const byName = new Map();
  for (const row of dataRows) {
    const get = (name) => (colIndex[name] >= 0 && row[colIndex[name]] != null ? String(row[colIndex[name]]).trim() : "");
    const fullName = get("fullName");
    if (!fullName) continue;

    const focusTags = parseFocusTags(row[colIndex["focusTags"]]);
    const contactUrlOrHandle = trim(row[colIndex["contactUrlOrHandle"]]) || null;
    const shortProjectTagline = get("shortProjectTagline");
    const expandedProjectDescription = get("expandedProjectDescription");

    const entry = {
      focusTags: Array.isArray(focusTags) ? focusTags : [],
      contactUrlOrHandle,
      shortProjectTagline,
      expandedProjectDescription,
    };

    const key = normalizeName(fullName);
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, entry);
      continue;
    }
    const score = (e) =>
      (e.focusTags?.length || 0) + (e.contactUrlOrHandle ? 2 : 0) + (e.shortProjectTagline ? 1 : 0) + (e.expandedProjectDescription ? 1 : 0);
    if (score(entry) > score(existing)) byName.set(key, entry);
  }

  return byName;
}

function hasValue(arr) {
  return Array.isArray(arr) && arr.length > 0;
}

function hasStr(s) {
  return s != null && String(s).trim() !== "";
}

async function main() {
  const sheets = await getSheetsClient({ write: true });
  if (!sheets) {
    console.error("Google Sheets write credentials required. Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS.");
    process.exit(1);
  }

  console.log("Loading People tab...");
  const peopleLookup = await loadPeopleLookup(sheets);
  console.log(`People tab: ${peopleLookup.size} unique names.`);

  console.log("Loading Real Data tab...");
  const loaded = await loadRealDataRecords({ write: true });
  console.log(`Real Data: ${loaded.records.length} rows.`);

  let updated = 0;
  for (let i = 0; i < loaded.records.length; i++) {
    const record = loaded.records[i];
    const key = normalizeName(record.person.fullName);
    const people = peopleLookup.get(key);
    if (!people) continue;

    const p = record.person;
    let changed = false;
    if (!hasValue(p.focusTags) && hasValue(people.focusTags)) {
      p.focusTags = people.focusTags;
      changed = true;
    }
    if (!hasStr(p.contactUrlOrHandle) && hasStr(people.contactUrlOrHandle)) {
      p.contactUrlOrHandle = people.contactUrlOrHandle;
      changed = true;
    }
    if (!hasStr(p.shortProjectTagline) && hasStr(people.shortProjectTagline)) {
      p.shortProjectTagline = people.shortProjectTagline;
      changed = true;
    }
    if (!hasStr(p.expandedProjectDescription) && hasStr(people.expandedProjectDescription)) {
      p.expandedProjectDescription = people.expandedProjectDescription;
      changed = true;
    }

    if (changed) {
      const toWrite = cloneRecord(record);
      toWrite.person = p;
      await upsertRealDataRecord(loaded.sheets, loaded.sheetName, toWrite);
      updated++;
      console.log(`  Updated: ${p.fullName}`);
      if (i < loaded.records.length - 1) await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log(`Done. ${updated} Real Data rows updated from People tab.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
