"use strict";

/**
 * Scoring. Pure: a poll and its ballots in, standings out.
 *
 * Truncated Borda — 3, 2, 1. A room phone can't award its own team; guests
 * and judges can award anyone. When both the room and the judges have voted,
 * each side is scaled to 50 and the two are added, so the judges weigh the
 * same however many phones are in the room.
 */

const { GUEST_TEAM } = require("./rules");

const POINTS = [3, 2, 1];

/** Ballot → three distinct, existing option ids, or null if it can't count. */
function countedPicks(ballot, score) {
  const free = ballot.kind === "judge" || ballot.kind === "guest";
  const team = String(ballot.teamOptionId || "");
  if (!free && (!team || team === GUEST_TEAM || !score[team])) return null;
  const seen = new Set(free ? [] : [team]);
  const picks = [];
  for (const id of [ballot.firstId, ballot.secondId, ballot.thirdId]) {
    const key = String(id || "");
    if (!key || seen.has(key) || !score[key]) return null;
    seen.add(key);
    picks.push(key);
  }
  return picks;
}

function scoreSide(poll, ballots) {
  const score = Object.fromEntries(
    poll.options.map((option) => [option.id, { points: 0, firsts: 0, seconds: 0, thirds: 0 }]),
  );
  const places = ["firsts", "seconds", "thirds"];
  let counted = 0;
  let pool = 0;
  for (const ballot of ballots) {
    const picks = countedPicks(ballot, score);
    if (!picks) continue;
    counted += 1;
    picks.forEach((id, index) => {
      score[id].points += POINTS[index];
      score[id][places[index]] += 1;
      pool += POINTS[index];
    });
  }
  return { score, counted, pool };
}

const round1 = (value) => Math.round(value * 10) / 10;

function tallyVotes(poll, ballots) {
  const room = scoreSide(
    poll,
    ballots.filter((ballot) => ballot.kind !== "judge"),
  );
  const judges = scoreSide(
    poll,
    ballots.filter((ballot) => ballot.kind === "judge"),
  );
  const weighted = room.pool > 0 && judges.pool > 0;

  const ranked = poll.options.map((option) => {
    const r = room.score[option.id];
    const j = judges.score[option.id];
    const points = weighted
      ? round1((r.points / room.pool) * 50 + (j.points / judges.pool) * 50)
      : r.points + j.points;
    return {
      ...option,
      points,
      audiencePoints: r.points,
      judgePoints: j.points,
      firsts: r.firsts + j.firsts,
      seconds: r.seconds + j.seconds,
      thirds: r.thirds + j.thirds,
    };
  });

  ranked.sort(
    (a, b) =>
      b.points - a.points ||
      b.judgePoints - a.judgePoints ||
      b.audiencePoints - a.audiencePoints ||
      b.firsts - a.firsts ||
      a.label.localeCompare(b.label),
  );
  ranked.forEach((row, index) => {
    const prev = ranked[index - 1];
    const tied =
      prev &&
      prev.points === row.points &&
      prev.judgePoints === row.judgePoints &&
      prev.audiencePoints === row.audiencePoints;
    row.place = tied ? prev.place : index + 1;
  });

  return {
    ranked,
    totalBallots: room.counted + judges.counted,
    audienceBallots: room.counted,
    judgeBallots: judges.counted,
    weighted,
  };
}

/** What a host needs to trust the count. */
function ballotStats(poll, ballots) {
  const { totalBallots } = tallyVotes(poll, ballots);
  return {
    phones: ballots.filter((ballot) => ballot.kind !== "judge").length,
    guests: ballots.filter((ballot) => ballot.kind === "guest").length,
    judges: ballots.filter((ballot) => ballot.kind === "judge").length,
    changedMind: ballots.filter((ballot) => ballot.revisions > 1).length,
    notCounted: ballots.length - totalBallots,
  };
}

function publicOption(option) {
  return {
    id: option.id,
    label: option.label,
    people: option.people || "",
    url: option.url || "",
  };
}

/**
 * The payload phones and the projector read. `asOf` lets a client drop a
 * response older than one it already showed, so a count never steps back.
 */
function publicPollShape(poll, ballots, yours, { reveal, asOf }) {
  const { ranked, totalBallots, audienceBallots, judgeBallots, weighted } = tallyVotes(
    poll,
    ballots,
  );
  return {
    id: poll.id,
    slug: poll.slug,
    question: poll.question,
    options: poll.options.map(publicOption),
    status: poll.status,
    eventId: poll.eventId || "",
    eventTitle: poll.eventTitle || "",
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
    closedAt: poll.closedAt || "",
    closesAt: poll.status === "live" ? poll.closesAt || "" : "",
    results: reveal
      ? ranked.map((row) => ({
          ...publicOption(row),
          points: row.points,
          audiencePoints: row.audiencePoints,
          judgePoints: row.judgePoints,
          firsts: row.firsts,
          seconds: row.seconds,
          thirds: row.thirds,
          votes: row.points,
          place: row.place,
        }))
      : [],
    scoresHidden: !reveal,
    totalVotes: totalBallots,
    audienceVotes: audienceBallots,
    judgeVotes: judgeBallots,
    weighted,
    asOf,
    yourOptionId: yours?.firstId || null,
    yourFirstId: yours?.firstId || null,
    yourSecondId: yours?.secondId || null,
    yourThirdId: yours?.thirdId || null,
    yourTeamId: yours?.teamOptionId || null,
  };
}

module.exports = { tallyVotes, ballotStats, publicPollShape };
