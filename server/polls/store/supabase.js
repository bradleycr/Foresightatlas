"use strict";

/**
 * Polls through Supabase's HTTP API. Same contract and the same guarantees
 * as the Postgres store — the atomic writes are SQL functions
 * (db/migrations/002_poll_functions.sql) — without holding a database
 * connection per server instance.
 */

const { rest, rpc } = require("../../db/supabase-rest");
const { pollFromRow, pollToRow, ballotFromRow } = require("./rows");

const PAGE = 1000;
const SAFE_KEY = /^[a-z0-9-]{1,80}$/;
const BALLOT_COLUMNS =
  "poll_id,voter_key,kind,person_id,team_option_id,first_option_id,second_option_id,third_option_id,revisions,created_at,updated_at";

const first = (rows) => (Array.isArray(rows) && rows[0] ? rows[0] : null);

async function listPolls() {
  return (await rest("polls?select=*&order=updated_at.desc")).map(pollFromRow);
}

/** Slug first: a slug and an old poll id can never point at different rows. */
async function findPoll(slugOrId) {
  const key = String(slugOrId || "").trim().toLowerCase();
  if (!SAFE_KEY.test(key)) return null;
  const rows = await rest(`polls?select=*&or=(slug.ilike.${key},id.ilike.${key})`);
  const match =
    rows.find((row) => row.slug.toLowerCase() === key) ||
    rows.find((row) => row.id.toLowerCase() === key);
  return match ? pollFromRow(match) : null;
}

/** A taken slug surfaces as code 23505, the same as over a Postgres socket. */
async function insertPoll(poll) {
  const rows = await rest("polls", {
    method: "POST",
    body: pollToRow(poll),
    prefer: "return=representation",
  });
  return pollFromRow(first(rows));
}

/** Lands only if nobody wrote since we read `version`; null on a lost race. */
async function savePoll(poll, { previousId = poll.id } = {}) {
  const { slug, created_at, created_by_person_id, created_by_name, ...changes } = pollToRow(poll);
  const rows = await rest(
    `polls?id=eq.${encodeURIComponent(previousId)}&version=eq.${Number(poll.version)}`,
    {
      method: "PATCH",
      body: { ...changes, version: Number(poll.version) + 1 },
      prefer: "return=representation",
    },
  );
  const row = first(rows);
  return row ? pollFromRow(row) : null;
}

async function closeIfDue(pollId) {
  const row = first(await rpc("poll_close_if_due", { p_poll_id: pollId }));
  return row ? pollFromRow(row) : null;
}

async function listBallots(pollIds) {
  const ids = [...new Set(pollIds)].filter(Boolean);
  if (!ids.length) return [];
  const list = ids.map((id) => `"${String(id).replace(/"/g, "")}"`).join(",");
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const rows = await rest(
      `poll_ballots?select=${BALLOT_COLUMNS}&poll_id=in.(${encodeURIComponent(list)})` +
        `&order=poll_id,voter_key&limit=${PAGE}&offset=${offset}`,
    );
    out.push(...rows.map(ballotFromRow));
    if (rows.length < PAGE) return out;
  }
}

async function castBallot(ballot, { knownKeys = [], deviceHint = "" } = {}) {
  const row = first(
    await rpc("poll_cast_ballot", {
      p_poll_id: ballot.pollId,
      p_voter_key: ballot.voterKey,
      p_kind: ballot.kind,
      p_person_id: ballot.personId || "",
      p_team_option_id: ballot.teamOptionId || "",
      p_first: ballot.firstId,
      p_second: ballot.secondId,
      p_third: ballot.thirdId,
      p_device_hint: deviceHint,
      p_known_keys: knownKeys,
    }),
  );
  return row ? ballotFromRow(row) : null;
}

async function ping() {
  await rest("polls?select=id&limit=1");
}

module.exports = {
  name: "supabase",
  listPolls,
  findPoll,
  insertPoll,
  savePoll,
  closeIfDue,
  listBallots,
  castBallot,
  ping,
};
