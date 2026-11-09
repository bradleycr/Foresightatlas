"use strict";

/** Database rows (snake_case, from Postgres or PostgREST) → the shapes the service uses. */

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

function pollToRow(poll) {
  return {
    id: poll.id,
    slug: poll.slug,
    event_id: poll.eventId || "",
    event_title: poll.eventTitle || "",
    question: poll.question,
    options: poll.options || [],
    status: poll.status,
    created_by_person_id: poll.createdByPersonId || "",
    created_by_name: poll.createdByName || "",
    created_at: poll.createdAt || new Date().toISOString(),
    updated_at: poll.updatedAt || new Date().toISOString(),
    closed_at: poll.closedAt || null,
    closes_at: poll.closesAt || null,
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

module.exports = { pollFromRow, pollToRow, ballotFromRow };
