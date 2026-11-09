#!/usr/bin/env node
/**
 * Copy polls and ballots from the Sheet (Polls + PollVotes) into Postgres.
 *
 *   pnpm polls:import            # dry run: prints what would be written
 *   pnpm polls:import --write    # write it
 *
 * Read-only on the Sheet; it stays as the archive. Safe to re-run: rows that
 * already exist in Postgres are left alone. Each phone's sheet rows collapse
 * into one ballot (its latest), with the row count kept as `revisions`.
 */

"use strict";

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { google } = require("googleapis");
const { getSpreadsheetId, SHEET_NAMES } = require("./sheet-schema.js");
const { query, closePool } = require("../server/db/postgres");

const WRITE = process.argv.includes("--write");
const GUEST_TEAM = "__guest__";

function sheetsAuth() {
  const scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFile && fs.existsSync(path.resolve(keyFile))) {
    return new google.auth.GoogleAuth({ keyFile: path.resolve(keyFile), scopes });
  }
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}"),
    scopes,
  });
}

function rowsAsObjects(values) {
  const [header = [], ...rows] = values || [];
  const keys = header.map((cell) => String(cell).trim());
  return rows.map((row) =>
    Object.fromEntries(keys.map((key, i) => [key, row[i] != null ? String(row[i]).trim() : ""])),
  );
}

function parseOptions(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed
          .map((item, index) =>
            item && typeof item === "object"
              ? {
                  id: String(item.id || index + 1),
                  label: String(item.label || "").trim(),
                  people: String(item.people || "").trim(),
                  url: String(item.url || "").trim(),
                }
              : { id: String(index + 1), label: String(item || "").trim(), people: "", url: "" },
          )
          .filter((option) => option.label)
      : [];
  } catch {
    return [];
  }
}

const isoOrNull = (value) => (value && Number.isFinite(Date.parse(value)) ? value : null);

/** Sheet rows → one ballot per (poll, phone). Judges collapse onto their seat. */
function collapseBallots(voteRows) {
  const byKey = new Map();
  for (const row of voteRows) {
    if (!row.pollId || !row.voterKey || !row.optionId) continue;
    const seat = /^judge:(\d+)$/.exec(row.personId || "");
    const judge = Boolean(seat) || row.fullName === "__judge__";
    const voterKey = seat ? `judge:${seat[1]}` : row.voterKey;
    const key = `${row.pollId}\u0000${voterKey}`;
    const prev = byKey.get(key);
    byKey.set(key, {
      pollId: row.pollId,
      voterKey,
      kind: judge ? "judge" : row.teamOptionId === GUEST_TEAM ? "guest" : "room",
      personId: seat ? voterKey : "",
      teamOptionId: judge ? "" : row.teamOptionId || "",
      firstId: row.optionId,
      secondId: row.secondOptionId,
      thirdId: row.thirdOptionId,
      revisions: (prev?.revisions || 0) + 1,
      createdAt: prev?.createdAt || row.createdAt,
      updatedAt: row.updatedAt || row.createdAt,
    });
  }
  return [...byKey.values()];
}

function isThreePickBallot(ballot) {
  const picks = [ballot.firstId, ballot.secondId, ballot.thirdId];
  return picks.every(Boolean) && new Set(picks).size === 3;
}

async function main() {
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: getSpreadsheetId(),
    ranges: [`'${SHEET_NAMES.POLLS}'`, `'${SHEET_NAMES.POLL_VOTES}'`],
  });
  const polls = rowsAsObjects(data.valueRanges[0].values).filter((row) => row.id && row.slug);
  const ballots = collapseBallots(rowsAsObjects(data.valueRanges[1].values));
  const importable = ballots.filter(isThreePickBallot);

  console.log(`Sheet: ${polls.length} polls, ${ballots.length} phones across all polls.`);
  console.log(`Skipping ${ballots.length - importable.length} single-pick ballots from older polls.`);

  let pollsWritten = 0;
  let ballotsWritten = 0;
  for (const poll of polls) {
    const mine = importable.filter((ballot) => ballot.pollId === poll.id);
    console.log(
      `  ${poll.slug.padEnd(16)} ${poll.status.padEnd(7)} ${String(mine.length).padStart(4)} ballots`,
    );
    if (!WRITE) continue;

    const inserted = await query(
      `insert into polls (
         id, slug, event_id, event_title, question, options, status,
         created_by_person_id, created_by_name, created_at, updated_at, closed_at, closes_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13)
       on conflict do nothing`,
      [
        poll.id,
        poll.slug,
        poll.eventId,
        poll.eventTitle,
        poll.question || "Vote for your favourite project",
        JSON.stringify(parseOptions(poll.options)),
        ["draft", "live", "closed"].includes(poll.status) ? poll.status : "draft",
        poll.createdByPersonId,
        poll.createdByName,
        isoOrNull(poll.createdAt) || new Date().toISOString(),
        isoOrNull(poll.updatedAt) || new Date().toISOString(),
        isoOrNull(poll.closedAt),
        isoOrNull(poll.closesAt),
      ],
    );
    pollsWritten += inserted.rowCount;
  }

  if (WRITE) {
    for (const ballot of importable) {
      const inserted = await query(
        `insert into poll_ballots (
           poll_id, voter_key, kind, person_id, team_option_id,
           first_option_id, second_option_id, third_option_id, revisions, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict do nothing`,
        [
          ballot.pollId,
          ballot.voterKey,
          ballot.kind,
          ballot.personId,
          ballot.teamOptionId,
          ballot.firstId,
          ballot.secondId,
          ballot.thirdId,
          ballot.revisions,
          isoOrNull(ballot.createdAt) || new Date().toISOString(),
          isoOrNull(ballot.updatedAt) || new Date().toISOString(),
        ],
      );
      ballotsWritten += inserted.rowCount;
    }
    console.log(`Wrote ${pollsWritten} new polls and ${ballotsWritten} new ballots.`);
  } else {
    console.log("Dry run. Pass --write to import.");
  }
  await closePool();
}

main().catch(async (err) => {
  console.error(err.message || err);
  await closePool().catch(() => {});
  process.exit(1);
});
