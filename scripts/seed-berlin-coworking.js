#!/usr/bin/env node
/**
 * Seed Berlin Node co-working Wednesdays (10:30–16:00, with lunch for nodees)
 * from April through end of November for the given year(s).
 *
 * Adds rows to the Google Sheet "Events" tab so they appear on Berlin Programming
 * and merge seamlessly with Luma (no duplicates). If you create a recurring event
 * on Luma, set each row's lumaEventId to the Luma api_id for that date to keep
 * details in sync.
 *
 * Usage:
 *   node scripts/seed-berlin-coworking.js [startYear] [endYear]
 *   node scripts/seed-berlin-coworking.js 2025 2026
 *
 * Requires write access to the sheet: GOOGLE_SERVICE_ACCOUNT_KEY or
 * GOOGLE_APPLICATION_CREDENTIALS. Without credentials, prints rows for manual paste.
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs").promises;
const path = require("path");
const { google } = require("googleapis");
const { SHEET_NAMES, EVENTS_HEADERS } = require("./sheet-schema.js");

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ";

/** Berlin: CEST (+02:00) until last Sun Oct, then CET (+01:00). We use +02 for Apr–Oct, +01 for Nov. */
function tzOffset(year, month) {
  return month === 11 ? "+01:00" : "+02:00";
}

/** All Wednesdays in a given month (1–31). */
function wednesdaysInMonth(year, month) {
  const out = [];
  const d = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= lastDay; day++) {
    d.setUTCDate(day);
    if (d.getUTCDay() === 3) out.push(day);
  }
  return out;
}

/**
 * Generate Berlin coworking events for every Wednesday from April through November.
 * @param {number} startYear
 * @param {number} endYear
 * @returns {Array<object>} Event objects matching sheet row shape
 */
function generateBerlinCoworking(startYear, endYear) {
  const events = [];
  for (let year = startYear; year <= endYear; year++) {
    for (const month of [4, 5, 6, 7, 8, 9, 10, 11]) {
      const offset = tzOffset(year, month);
      for (const day of wednesdaysInMonth(year, month)) {
        const pad = (n) => String(n).padStart(2, "0");
        const dateStr = `${year}-${pad(month)}-${pad(day)}`;
        events.push({
          id: `berlin-coworking-${dateStr}`,
          nodeSlug: "berlin",
          title: "Co-working Day (Nodees)",
          description:
            "Weekly co-working at the Berlin Node. Bring your laptop, join for deep work 10:30–16:00, and lunch together with other nodees. Open to Foresight grantees, fellows, and the node community.",
          location: "Berlin Node",
          startAt: `${dateStr}T10:30:00${offset}`,
          endAt: `${dateStr}T16:00:00${offset}`,
          type: "coworking",
          tags: ["coworking", "nodees", "berlin"],
          visibility: "public",
          capacity: null,
          externalLink: "",
          recurrenceGroupId: "berlin-coworking-wednesdays",
          lumaEventId: "",
          coverImageUrl: "",
        });
      }
    }
  }
  return events;
}

function eventToRow(e) {
  return [
    e.id ?? "",
    e.nodeSlug ?? "berlin",
    e.title ?? "",
    e.description ?? "",
    e.location ?? "",
    e.startAt ?? "",
    e.endAt ?? "",
    e.type ?? "coworking",
    Array.isArray(e.tags) ? JSON.stringify(e.tags) : (e.tags ?? "[]"),
    e.visibility ?? "public",
    e.capacity != null ? String(e.capacity) : "",
    e.externalLink ?? "",
    e.recurrenceGroupId ?? "",
    e.lumaEventId ?? "",
    e.coverImageUrl ?? "",
  ];
}

async function getExistingEventIds(sheets) {
  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAMES.EVENTS}'!A2:A`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const values = data.values || [];
    return new Set(values.map((row) => String(row[0] || "").trim()).filter(Boolean));
  } catch (err) {
    if (err.code === 400 && err.message?.includes("Unable to parse range")) {
      return new Set();
    }
    throw err;
  }
}

async function appendToSheet(sheets, rows) {
  if (rows.length === 0) return;
  const range = `'${SHEET_NAMES.EVENTS}'!A:O`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

async function main() {
  const startYear = parseInt(process.argv[2] || "2025", 10);
  const endYear = parseInt(process.argv[3] || startYear, 10);

  if (Number.isNaN(startYear) || Number.isNaN(endYear) || startYear > endYear) {
    console.error("Usage: node scripts/seed-berlin-coworking.js [startYear] [endYear]");
    process.exit(1);
  }

  const generated = generateBerlinCoworking(startYear, endYear);
  console.log(
    `Generated ${generated.length} Berlin coworking Wednesdays (${startYear} Apr–Nov${endYear > startYear ? `, ${endYear} Apr–Nov` : ""}).`
  );

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  let key;
  if (keyJson) {
    try {
      key = typeof keyJson === "string" ? JSON.parse(keyJson) : keyJson;
    } catch (err) {
      console.error("GOOGLE_SERVICE_ACCOUNT_KEY is invalid JSON:", err.message);
      process.exit(1);
    }
  } else if (keyPath) {
    const resolved = path.resolve(keyPath);
    try {
      key = JSON.parse(await fs.readFile(resolved, "utf8"));
    } catch (err) {
      console.error("Could not read service account key from", resolved, err.message);
      process.exit(1);
    }
  }

  if (!key) {
    console.log("\nNo sheet credentials — paste these rows into the Events tab (row 2 onward).");
    console.log("Header row:", EVENTS_HEADERS.join("\t"));
    for (const e of generated) {
      console.log(eventToRow(e).map((c) => (c.includes("\t") ? `"${c}"` : c)).join("\t"));
    }
    console.log("\nSheet: https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID + "/edit");
    return;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const existingIds = await getExistingEventIds(sheets);
  const toAdd = generated.filter((e) => !existingIds.has(e.id));
  const skipped = generated.length - toAdd.length;
  if (skipped > 0) {
    console.log(`Skipped ${skipped} events that already exist in the sheet.`);
  }
  if (toAdd.length === 0) {
    console.log("Nothing new to append.");
    return;
  }

  const rows = toAdd.map(eventToRow);
  await appendToSheet(sheets, rows);
  console.log(`Appended ${rows.length} rows to Events tab.`);
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
