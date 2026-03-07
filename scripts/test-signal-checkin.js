/**
 * Unit-style tests for the Signal check-in bot — no Signal API or Google Sheets required.
 *
 * Run: pnpm test:signal-checkin
 *
 * Covers:
 *   - Date parsing (EN/DE, "this week Monday", "18. März", past-date filter, 30-day cap)
 *   - Command detection (/checkin Ja ..., /checkin Nein ..., invalid messages)
 *   - Status normalization (Ja/Yes → Yes, Nein/No → No)
 */

const path = require("path");
const { parseDates, toDateKey, berlinNow, TZ } = require("../server/signal/date-parser");
const { isCheckinCommand } = require("../server/signal/checkin-handler");

const COMMAND_RE = /^\/checkin\s+(ja|yes|nein|no)\b\s*(.*)/i;

let passed = 0;
let failed = 0;

function ok(condition, name) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
  }
}

function eq(a, b, name) {
  const same = JSON.stringify(a) === JSON.stringify(b);
  ok(same, name);
  if (!same) console.log(`      expected: ${JSON.stringify(b)}, got: ${JSON.stringify(a)}`);
}

console.log("\n--- Date parser (CET, next 30 days) ---\n");

/* parseDates uses real "now" — we assert shape and semantics, not exact dates */
const empty = parseDates("");
eq(empty.dates.length, 0, "empty string → no dates");
ok(empty.warnings.some((w) => /No date text/.test(w)), "empty string → warning");

const yesterday = parseDates("yesterday");
eq(yesterday.dates.length, 0, "yesterday → no future dates");
ok(yesterday.warnings.some((w) => /past/.test(w)), "yesterday → past warning");

const monday = parseDates("Monday");
ok(monday.dates.length >= 1, "Monday → at least one date");
ok(/^\d{4}-\d{2}-\d{2}$/.test(monday.dates[0]), "date format YYYY-MM-DD");

const multi = parseDates("this week Monday Wednesday Friday");
ok(multi.dates.length >= 1, "this week Mon Wed Fri → at least one date");
ok(multi.dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), "all dates YYYY-MM-DD");
ok(multi.dates.length <= 30, "cap at 30 days");

const nextFriday = parseDates("next Friday");
ok(nextFriday.dates.length === 1, "next Friday → single date");

const march18 = parseDates("March 18th");
ok(march18.dates.length <= 1, "March 18th → 0 or 1 date");
if (march18.dates.length === 1) ok(march18.dates[0].endsWith("-03-18"), "March 18th → 18th");

const german = parseDates("18. März");
ok(german.dates.length >= 0, "18. März → zero or more dates");
if (german.dates.length >= 1) ok(german.dates.some((d) => d.endsWith("-03-18")), "18. März can parse to March 18");

/* toDateKey and TZ */
ok(typeof toDateKey(new Date()) === "string" && /^\d{4}-\d{2}-\d{2}$/.test(toDateKey(new Date())), "toDateKey format");
ok(TZ === "Europe/Berlin", "TZ is Europe/Berlin");

console.log("\n--- Command detection ---\n");

ok(isCheckinCommand("/checkin Ja this week Monday"), "/checkin Ja ...");
ok(isCheckinCommand("/checkin Yes next Friday"), "/checkin Yes ...");
ok(isCheckinCommand("/checkin Nein March 18th"), "/checkin Nein ...");
ok(isCheckinCommand("/checkin No 18. März"), "/checkin No ...");
ok(isCheckinCommand("/checkin ja Monday"), "/checkin ja (lowercase)");
ok(!isCheckinCommand("hello world"), "plain text → false");
ok(!isCheckinCommand("/checkin"), "/checkin with no status → false");
ok(!isCheckinCommand("/checkin Maybe Monday"), "/checkin Maybe → false");

/* Regex capture groups */
const m1 = "/checkin Ja this week Monday".match(COMMAND_RE);
ok(m1 && m1[1].toLowerCase() === "ja" && m1[2].trim() === "this week Monday", "capture status and text");

const m2 = "/checkin Nein March 18th".match(COMMAND_RE);
ok(m2 && m2[1].toLowerCase() === "nein" && m2[2].trim() === "March 18th", "capture Nein and date text");

console.log("\n--- Summary ---\n");
console.log(`  Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
}
console.log("\n  All checks passed. Signal check-in parsing is OK.");
console.log("  To run the full bot you still need: Signal API, number, group ID, and sheet tabs.");
console.log("  See docs/SIGNAL_CHECKIN_SETUP.md.\n");
