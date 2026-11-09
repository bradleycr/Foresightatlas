"use strict";

/**
 * Polls over a direct Postgres connection — for self-hosting, where there is
 * no Supabase HTTP API. Writes go through the same SQL functions as the
 * Supabase store, so both behave identically:
 *
 *   - a ballot is an upsert on (poll_id, voter_key) — one row per phone —
 *     guarded by the poll being live, in the same statement
 *   - a poll edit only lands if `version` is still what we read
 *   - closing at the deadline only fires while the poll is still live
 */

const { query } = require("../../db/postgres");
const { pollFromRow, pollToRow, ballotFromRow } = require("./rows");

const first = (rows) => rows[0] || null;

async function listPolls() {
  const { rows } = await query("select * from polls order by updated_at desc");
  return rows.map(pollFromRow);
}

/** Slug first: a slug and an old poll id can never point at different rows. */
async function findPoll(slugOrId) {
  const key = String(slugOrId || "").trim().toLowerCase();
  if (!key) return null;
  const { rows } = await query(
    `select * from polls
      where lower(slug) = $1 or lower(id) = $1
      order by (lower(slug) = $1) desc
      limit 1`,
    [key],
  );
  return rows[0] ? pollFromRow(rows[0]) : null;
}

async function insertPoll(poll) {
  const row = pollToRow(poll);
  const { rows } = await query(
    `insert into polls (
       id, slug, event_id, event_title, question, options, status,
       created_by_person_id, created_by_name, created_at, updated_at, closed_at, closes_at)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13)
     returning *`,
    [
      row.id,
      row.slug,
      row.event_id,
      row.event_title,
      row.question,
      JSON.stringify(row.options),
      row.status,
      row.created_by_person_id,
      row.created_by_name,
      row.created_at,
      row.updated_at,
      row.closed_at,
      row.closes_at,
    ],
  );
  return pollFromRow(rows[0]);
}

/**
 * Write a poll back only if nobody else wrote it since we read `version`.
 * `previousId` covers a reset, which rotates the id but keeps the row.
 */
async function savePoll(poll, { previousId = poll.id } = {}) {
  const row = pollToRow(poll);
  const { rows } = await query(
    `update polls set
       id = $2, event_id = $3, event_title = $4, question = $5, options = $6::jsonb,
       status = $7, updated_at = $8, closed_at = $9, closes_at = $10,
       version = version + 1
     where id = $1 and version = $11
     returning *`,
    [
      previousId,
      row.id,
      row.event_id,
      row.event_title,
      row.question,
      JSON.stringify(row.options),
      row.status,
      row.updated_at,
      row.closed_at,
      row.closes_at,
      poll.version,
    ],
  );
  return rows[0] ? pollFromRow(rows[0]) : null;
}

async function closeIfDue(pollId) {
  const { rows } = await query("select * from poll_close_if_due($1)", [pollId]);
  return first(rows) ? pollFromRow(rows[0]) : null;
}

async function listBallots(pollIds) {
  const ids = [...new Set(pollIds)].filter(Boolean);
  if (!ids.length) return [];
  const { rows } = await query("select * from poll_ballots where poll_id = any($1::text[])", [ids]);
  return rows.map(ballotFromRow);
}

async function castBallot(ballot, { knownKeys = [], deviceHint = "" } = {}) {
  const { rows } = await query(
    "select * from poll_cast_ballot($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[])",
    [
      ballot.pollId,
      ballot.voterKey,
      ballot.kind,
      ballot.personId || "",
      ballot.teamOptionId || "",
      ballot.firstId,
      ballot.secondId,
      ballot.thirdId,
      deviceHint,
      knownKeys,
    ],
  );
  return first(rows) ? ballotFromRow(rows[0]) : null;
}

async function ping() {
  await query("select 1");
}

module.exports = {
  name: "postgres",
  listPolls,
  findPoll,
  insertPoll,
  savePoll,
  closeIfDue,
  listBallots,
  castBallot,
  ping,
};
