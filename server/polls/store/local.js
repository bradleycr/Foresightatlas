"use strict";

/**
 * Polls in the local mock JSON file, for contributors without a database.
 * Same contract as the Postgres store. One process, so writes don't race.
 */

const {
  getLocalDatabase,
  upsertLocalPoll,
  upsertLocalPollBallot,
} = require("../../local-storage");

/** Older mock files kept judges as a fullName marker. */
function kindOf(row) {
  if (row.kind) return row.kind;
  if (row.fullName === "__judge__" || /^judge:\d+$/.test(String(row.personId || ""))) {
    return "judge";
  }
  return row.teamOptionId === "__guest__" ? "guest" : "room";
}

function ballotFromRow(row) {
  return {
    pollId: row.pollId,
    voterKey: row.voterKey,
    kind: kindOf(row),
    personId: row.personId || "",
    teamOptionId: row.teamOptionId || "",
    firstId: row.firstId || row.optionId,
    secondId: row.secondId || row.secondOptionId,
    thirdId: row.thirdId || row.thirdOptionId,
    revisions: Number(row.revisions) || 1,
    createdAt: row.createdAt || "",
    updatedAt: row.updatedAt || "",
  };
}

function pollFromRow(row) {
  return { ...row, options: Array.isArray(row.options) ? row.options : [], version: 1 };
}

async function listPolls() {
  const db = await getLocalDatabase();
  return db.polls.map(pollFromRow);
}

async function findPoll(slugOrId) {
  const key = String(slugOrId || "").trim().toLowerCase();
  if (!key) return null;
  const polls = await listPolls();
  return (
    polls.find((poll) => String(poll.slug).toLowerCase() === key) ||
    polls.find((poll) => String(poll.id).toLowerCase() === key) ||
    null
  );
}

async function insertPoll(poll) {
  return pollFromRow(await upsertLocalPoll(poll));
}

async function savePoll(poll, { previousId = poll.id } = {}) {
  return pollFromRow(await upsertLocalPoll(poll, { previousId }));
}

async function closeIfDue(pollId) {
  const poll = await findPoll(pollId);
  if (!poll || poll.status !== "live" || !poll.closesAt) return null;
  if (Date.parse(poll.closesAt) > Date.now()) return null;
  return savePoll({ ...poll, status: "closed", closedAt: poll.closesAt, updatedAt: new Date().toISOString() });
}

/** Collapse to one ballot per phone, last write wins. */
async function listBallots(pollIds) {
  const wanted = new Set(pollIds);
  const db = await getLocalDatabase();
  const latest = new Map();
  for (const row of db.pollVotes) {
    if (!wanted.has(row.pollId)) continue;
    latest.set(`${row.pollId}\u0000${row.voterKey}`, row);
  }
  return [...latest.values()].map(ballotFromRow);
}

/** Same contract as Postgres: null when voting is closed, else this phone's one row. */
async function castBallot(ballot, { knownKeys = [] } = {}) {
  const poll = await findPoll(ballot.pollId);
  const open =
    poll?.status === "live" && (!poll.closesAt || Date.parse(poll.closesAt) > Date.now());
  if (!open) return null;
  const keys = new Set(knownKeys);
  const prior = (await listBallots([ballot.pollId])).reverse().find((row) => keys.has(row.voterKey));
  return ballotFromRow(
    await upsertLocalPollBallot({ ...ballot, voterKey: prior?.voterKey || ballot.voterKey }),
  );
}

async function ping() {}

module.exports = {
  name: "local",
  listPolls,
  findPoll,
  insertPoll,
  savePoll,
  closeIfDue,
  listBallots,
  castBallot,
  ping,
};
