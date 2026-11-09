"use strict";

/**
 * Polls in Postgres. Every write is a single statement the database makes
 * atomic, so concurrency is the database's job, not ours:
 *
 *   - a ballot is an upsert on (poll_id, voter_key) — one row per phone —
 *     guarded by the poll being live, in the same statement
 *   - a poll edit only lands if `version` is still what we read
 *   - closing at the deadline only fires while the poll is still live
 */

const { query } = require("../../db/postgres");

const iso = (value) => (value ? new Date(value).toISOString() : "");

function pollFromRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    eventId: row.event_id,
    eventTitle: row.event_title,
    question: row.question,
    options: Array.isArray(row.options) ? row.options : [],
    status: row.status,
    createdByPersonId: row.created_by_person_id,
    createdByName: row.created_by_name,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    closedAt: iso(row.closed_at),
    closesAt: iso(row.closes_at),
    version: row.version,
  };
}

function ballotFromRow(row) {
  return {
    pollId: row.poll_id,
    voterKey: row.voter_key,
    kind: row.kind,
    personId: row.person_id,
    teamOptionId: row.team_option_id,
    firstId: row.first_option_id,
    secondId: row.second_option_id,
    thirdId: row.third_option_id,
    revisions: row.revisions,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

const POLL_COLUMNS = `
  id, slug, event_id, event_title, question, options, status,
  created_by_person_id, created_by_name, created_at, updated_at,
  closed_at, closes_at, version`;

async function listPolls() {
  const { rows } = await query(`select ${POLL_COLUMNS} from polls order by updated_at desc`);
  return rows.map(pollFromRow);
}

/** Slug first: a slug and an old poll id can never point at different rows. */
async function findPoll(slugOrId) {
  const key = String(slugOrId || "").trim().toLowerCase();
  if (!key) return null;
  const { rows } = await query(
    `select ${POLL_COLUMNS} from polls
      where lower(slug) = $1 or lower(id) = $1
      order by (lower(slug) = $1) desc
      limit 1`,
    [key],
  );
  return rows[0] ? pollFromRow(rows[0]) : null;
}

async function insertPoll(poll) {
  const { rows } = await query(
    `insert into polls (
       id, slug, event_id, event_title, question, options, status,
       created_by_person_id, created_by_name, created_at, updated_at, closed_at, closes_at)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13)
     returning ${POLL_COLUMNS}`,
    [
      poll.id,
      poll.slug,
      poll.eventId || "",
      poll.eventTitle || "",
      poll.question,
      JSON.stringify(poll.options || []),
      poll.status,
      poll.createdByPersonId || "",
      poll.createdByName || "",
      poll.createdAt || new Date().toISOString(),
      poll.updatedAt || new Date().toISOString(),
      poll.closedAt || null,
      poll.closesAt || null,
    ],
  );
  return pollFromRow(rows[0]);
}

/**
 * Write a poll back only if nobody else wrote it since we read `version`.
 * `previousId` covers a reset, which rotates the id but keeps the row.
 *
 * @returns {Promise<object|null>} the saved poll, or null on a lost race
 */
async function savePoll(poll, { previousId = poll.id } = {}) {
  const { rows } = await query(
    `update polls set
       id = $2, event_id = $3, event_title = $4, question = $5, options = $6::jsonb,
       status = $7, updated_at = $8, closed_at = $9, closes_at = $10,
       version = version + 1
     where id = $1 and version = $11
     returning ${POLL_COLUMNS}`,
    [
      previousId,
      poll.id,
      poll.eventId || "",
      poll.eventTitle || "",
      poll.question,
      JSON.stringify(poll.options || []),
      poll.status,
      poll.updatedAt || new Date().toISOString(),
      poll.closedAt || null,
      poll.closesAt || null,
      poll.version,
    ],
  );
  return rows[0] ? pollFromRow(rows[0]) : null;
}

/** Live → closed once the final minute has run out. A no-op for everyone else. */
async function closeIfDue(pollId) {
  const { rows } = await query(
    `update polls set
       status = 'closed', closed_at = closes_at, updated_at = now(), version = version + 1
     where id = $1 and status = 'live' and closes_at is not null and closes_at <= now()
     returning ${POLL_COLUMNS}`,
    [pollId],
  );
  return rows[0] ? pollFromRow(rows[0]) : null;
}

const BALLOT_COLUMNS = `
  poll_id, voter_key, kind, person_id, team_option_id,
  first_option_id, second_option_id, third_option_id, revisions, created_at, updated_at`;

async function listBallots(pollIds) {
  const ids = [...new Set(pollIds)].filter(Boolean);
  if (!ids.length) return [];
  const { rows } = await query(
    `select ${BALLOT_COLUMNS} from poll_ballots where poll_id = any($1::text[])`,
    [ids],
  );
  return rows.map(ballotFromRow);
}

/**
 * Cast a ballot in one round trip. In a single statement the database:
 *   - refuses unless the poll is live and its final minute hasn't run out
 *   - finds the row this phone already owns under any of its known keys
 *   - inserts, or overwrites that row — resubmitting never adds a ballot
 *
 * @returns {Promise<object|null>} the ballot, or null if voting is closed
 */
async function castBallot(ballot, { knownKeys = [], deviceHint = "" } = {}) {
  const { rows } = await query(
    `with open_poll as (
       select id from polls
        where id = $1 and status = 'live' and (closes_at is null or closes_at > now())
     ),
     prior as (
       select voter_key from poll_ballots
        where poll_id = $1 and voter_key = any($10::text[])
        order by updated_at desc
        limit 1
     )
     insert into poll_ballots (
       poll_id, voter_key, kind, person_id, team_option_id,
       first_option_id, second_option_id, third_option_id, device_hint)
     select $1, coalesce((select voter_key from prior), $2), $3, $4, $5, $6, $7, $8, $9
      where exists (select 1 from open_poll)
     on conflict (poll_id, voter_key) do update set
       kind = excluded.kind,
       person_id = excluded.person_id,
       team_option_id = excluded.team_option_id,
       first_option_id = excluded.first_option_id,
       second_option_id = excluded.second_option_id,
       third_option_id = excluded.third_option_id,
       device_hint = excluded.device_hint,
       revisions = poll_ballots.revisions + 1,
       updated_at = now()
     returning ${BALLOT_COLUMNS}`,
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
  return rows[0] ? ballotFromRow(rows[0]) : null;
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
