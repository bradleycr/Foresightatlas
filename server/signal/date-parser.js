/**
 * Natural-language date parser anchored to CET (Europe/Berlin).
 *
 * Accepts English and German date expressions — "this week Monday Wednesday",
 * "next Friday", "March 18th", "18. März" — and returns an array of YYYY-MM-DD
 * strings normalized to the Berlin timezone.
 *
 * Uses chrono-node under the hood with a 30-day future cap.
 */

const chrono = require("chrono-node");

const TZ = "Europe/Berlin";
const MAX_FUTURE_DAYS = 30;

/**
 * Build a "now" Date anchored to Berlin wall-clock time so relative expressions
 * like "this Monday" resolve correctly regardless of the server's OS timezone.
 */
function berlinNow() {
  const iso = new Date().toLocaleString("sv-SE", { timeZone: TZ });
  return new Date(iso);
}

/**
 * Format a Date as YYYY-MM-DD in Berlin timezone.
 * @param {Date} d
 */
function toDateKey(d) {
  const pad = (n) => String(n).padStart(2, "0");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const day = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${day}`;
}

/**
 * Midnight in Berlin for a YYYY-MM-DD string (for comparison).
 * @param {string} key — "2026-03-10"
 */
function berlinMidnight(key) {
  return new Date(`${key}T00:00:00+01:00`);
}

/**
 * Custom chrono parser for German day-of-week names that chrono's built-in DE
 * refiner sometimes misses when mixed with English text.
 */
const germanDayNames = {
  montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4,
  freitag: 5, samstag: 6, sonntag: 0,
};

/**
 * Pre-process the raw text to help chrono parse compound expressions.
 *
 * "this week Monday Wednesday Friday" is really three separate dates.
 * We split on known day names so chrono sees each one individually.
 *
 * Chrono's forwardDate works best with bare day names ("Monday" → next Mon)
 * but its "this week" qualifier is unreliable when those days are already past
 * in the current calendar week. We strip "this week" / "diese Woche" and keep
 * "next week" / "nächste Woche" so chrono picks the right occurrence.
 *
 * @param {string} text
 * @returns {string[]} — one string per parseable fragment
 */
function splitDateFragments(text) {
  const dayPattern =
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/gi;

  const days = [...text.matchAll(dayPattern)];
  if (days.length <= 1) return [text];

  const qualifierRe =
    /^(.*?\b(?:this\s+week|next\s+week|diese\s+woche|nächste\s+woche)\b)\s*/i;
  const qMatch = text.match(qualifierRe);
  let prefix = qMatch ? qMatch[1].trim() : "";

  /*
   * "this week" / "diese Woche" confuses chrono when the named days are already
   * past. Drop it; forwardDate: true already picks the next occurrence of each
   * bare day name. Keep "next week" since it correctly targets the following week.
   */
  if (/\b(this\s+week|diese\s+woche)\b/i.test(prefix)) {
    prefix = "";
  }

  return days.map((m) => (prefix ? `${prefix} ${m[0]}` : m[0]));
}

/**
 * Run both English (default) and German parsers, returning the merged result
 * set. This lets users mix languages in the same group: "Ja this week Monday"
 * or "Ja 18. März" both work.
 *
 * @param {string} fragment
 * @param {Date}   now
 * @returns {import('chrono-node').ParsedResult[]}
 */
function parseWithBothLocales(fragment, now) {
  const en = chrono.parse(fragment, now, { forwardDate: true });
  const de = chrono.de.casual.parse(fragment, now, { forwardDate: true });
  return [...en, ...de];
}

/**
 * Parse natural-language text into an array of unique YYYY-MM-DD date strings.
 *
 * @param {string} text — the part of the command after the status word
 * @returns {{ dates: string[], warnings: string[] }}
 */
function parseDates(text) {
  if (!text || !text.trim()) return { dates: [], warnings: ["No date text provided."] };

  const now = berlinNow();
  const todayKey = toDateKey(now);
  const cap = new Date(now.getTime() + MAX_FUTURE_DAYS * 86_400_000);

  const fragments = splitDateFragments(text);
  const seen = new Set();
  const dates = [];
  const warnings = [];

  for (const fragment of fragments) {
    const results = parseWithBothLocales(fragment, now);

    for (const result of results) {
      const d = result.start.date();
      const key = toDateKey(d);

      /* Skip past dates */
      if (key < todayKey) {
        warnings.push(`"${result.text}" → ${key} is in the past — skipped.`);
        continue;
      }

      /* Cap at MAX_FUTURE_DAYS */
      if (d > cap) {
        warnings.push(`"${result.text}" → ${key} is more than ${MAX_FUTURE_DAYS} days out — skipped.`);
        continue;
      }

      if (!seen.has(key)) {
        seen.add(key);
        dates.push(key);
      }
    }
  }

  /* Sort chronologically */
  dates.sort();

  return { dates, warnings };
}

module.exports = { parseDates, toDateKey, berlinNow, TZ };
