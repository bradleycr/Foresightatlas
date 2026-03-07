/**
 * Core handler for /checkin commands received from Signal.
 *
 * Parses the command text, resolves dates via chrono-node, deduplicates against
 * the DailyTable, writes to both sheet tabs, and returns a human-readable reply.
 *
 * Command grammar:
 *   /checkin (Ja|Yes|Nein|No) <date expression>
 *
 * Examples:
 *   /checkin Ja this week Monday Wednesday Friday
 *   /checkin Nein March 18th
 *   /checkin Yes next Friday
 *   /checkin Ja 18. März
 */

const { parseDates, toDateKey, berlinNow, TZ } = require("./date-parser");
const { appendSignalCheckin, upsertDailyTableRows, queryDailyTable } = require("./sheets-ops");

const COMMAND_RE = /^\/checkin\s+(ja|yes|nein|no)\b\s*(.*)/i;

/**
 * Map the user's status word to a canonical value for the sheet.
 * @param {string} word
 */
function normalizeStatus(word) {
  return /^(ja|yes)$/i.test(word) ? "Yes" : "No";
}

/**
 * Format a YYYY-MM-DD key as a friendly short date ("Mon 10 Mar").
 * @param {string} key
 */
function friendlyDate(key) {
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TZ,
  });
}

/**
 * Process a single /checkin message.
 *
 * @param {{
 *   messageText: string,
 *   senderPhone: string,
 *   senderName: string,
 *   groupId: string,
 *   nodeSlug: string,
 * }} ctx
 * @returns {Promise<string>} — reply text to send back to the group
 */
async function handleCheckin(ctx) {
  const { messageText, senderPhone, senderName, groupId, nodeSlug } = ctx;

  const match = messageText.match(COMMAND_RE);
  if (!match) return null;

  const statusWord = match[1];
  const dateText = match[2].trim();
  const status = normalizeStatus(statusWord);

  /* ── Date parsing ─────────────────────────────────────────────────────── */

  const { dates, warnings } = parseDates(dateText);

  if (!dates.length && !dateText) {
    /* No date text at all — log as TBD */
    await appendSignalCheckin({
      timestamp: new Date().toISOString(),
      userPhone: senderPhone,
      userName: senderName,
      action: status,
      rawMessage: messageText,
      parsedDates: "TBD",
      nodeSlug,
      groupId,
    });
    return `${senderName}: Logged "${status}" but couldn't find any dates. Please specify like: /checkin Ja Monday Wednesday Friday`;
  }

  if (!dates.length) {
    return `${senderName}: Could not parse valid future dates from "${dateText}". Please try again with dates like: Monday, next Friday, March 18th`;
  }

  /* ── Dedupe check ─────────────────────────────────────────────────────── */

  let existing = [];
  try {
    existing = await queryDailyTable(nodeSlug, {
      phone: senderPhone,
      dates,
    });
  } catch (e) {
    console.warn("[checkin-handler] Dedupe query failed, proceeding without:", e.message);
  }

  const alreadySet = new Set(
    existing
      .filter((r) => r.Status === status)
      .map((r) => r.Date),
  );

  const newDates = dates.filter((d) => !alreadySet.has(d));
  const skippedDates = dates.filter((d) => alreadySet.has(d));

  /* ── Write to SignalCheckins (always, for the audit trail) ────────────── */

  await appendSignalCheckin({
    timestamp: new Date().toISOString(),
    userPhone: senderPhone,
    userName: senderName,
    action: status,
    rawMessage: messageText,
    parsedDates: dates.join(","),
    nodeSlug,
    groupId,
  });

  /* ── Upsert DailyTable rows ──────────────────────────────────────────── */

  if (newDates.length) {
    const rows = newDates.map((date) => ({
      date,
      userPhone: senderPhone,
      userName: senderName,
      status,
      notes: "",
    }));
    await upsertDailyTableRows(nodeSlug, rows);
  }

  /* ── Compose reply ────────────────────────────────────────────────────── */

  const parts = [];

  if (newDates.length) {
    const label = status === "Yes" ? "Checked in" : "Checked out";
    parts.push(`${label} for ${newDates.map(friendlyDate).join(", ")}`);
  }

  if (skippedDates.length) {
    parts.push(`already ${status.toLowerCase()} for ${skippedDates.map(friendlyDate).join(", ")}`);
  }

  if (warnings.length) {
    parts.push(warnings.join(" "));
  }

  return `${senderName}: ${parts.join(". ")}.`;
}

/**
 * Test whether a message looks like a /checkin command (fast check for the poller).
 * @param {string} text
 */
function isCheckinCommand(text) {
  return COMMAND_RE.test(text);
}

module.exports = { handleCheckin, isCheckinCommand };
