/**
 * Event polls — the service the API calls.
 *
 * Designed like Mentimeter / Slido: a short slug in a QR lands a phone on a
 * one-question vote screen. Draft → live → closed; closed polls stay in the
 * archive. Storage is Postgres (see server/polls/store), where each phone
 * owns exactly one ballot row, so the count is the number of phones — no
 * matter how many times anyone taps Submit.
 *
 * Reads go through a short per-poll snapshot so a full room polling the
 * projector costs the database one query pair per second per instance.
 */

"use strict";

const { parseRoleTypes } = require("./role-types");
const { rateLimit } = require("./rate-limit");
const { pollStore } = require("./polls/store");
const {
  STATUSES,
  MIN_LIVE_OPTIONS,
  FINAL_MINUTE_MS,
  GUEST_TEAM,
  randomSlug,
  normalizeQuestion,
  normalizeOptions,
  appendProject,
  cleanPeople,
  cleanGithubRepo,
  cleanUrl,
  sameLabel,
} = require("./polls/rules");
const { tallyVotes, ballotStats, publicPollShape } = require("./polls/tally");
const {
  JUDGE_SEATS,
  verifyJudgeToken,
  judgeBallotKey,
  listJudgeLinks,
} = require("./polls/judges");
const { hashVoterKey, clientIp } = require("./polls/voter");

const TEAM_ROLE = "Foresight Team";
const SNAPSHOT_MS = 1500;
const EDIT_ATTEMPTS = 5;

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/* ── Snapshot: one read serves every phone on this instance for a moment ── */

const snapshots = new Map();
const inflight = new Map();

function forgetSnapshots() {
  snapshots.clear();
}

async function readSnapshot(slugOrId) {
  const key = String(slugOrId || "").trim().toLowerCase();
  const cached = snapshots.get(key);
  if (cached && Date.now() - cached.at < SNAPSHOT_MS) return cached;
  if (inflight.has(key)) return inflight.get(key);

  const pending = (async () => {
    try {
      const store = pollStore();
      let poll = await store.findPoll(key);
      if (!poll) throw httpError(404, "This poll is not available.");
      poll = (await settle(poll)) || poll;
      /*
       * Stamp the snapshot when the ballot read *starts*: everything saved
       * before that moment is in it. Comparing stamps then never shows a
       * count going backwards, whichever instance answers.
       */
      const at = Date.now();
      const ballots = await store.listBallots([poll.id]);
      const snapshot = { at, poll, ballots };
      snapshots.set(key, snapshot);
      return snapshot;
    } catch (err) {
      /* A database blip shouldn't blank the projector: serve the last good read. */
      if (cached && err.statusCode !== 404) return cached;
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, pending);
  return pending;
}

/* ── Poll lifecycle ── */

/** Close a live poll whose final minute ran out. Returns the closed poll, if any. */
async function settle(poll) {
  if (poll.status !== "live" || !poll.closesAt) return null;
  if (Date.parse(poll.closesAt) > Date.now()) return null;
  const closed = await pollStore().closeIfDue(poll.id);
  if (closed) forgetSnapshots();
  return closed;
}

/**
 * Read, change, write — and if someone else wrote in between, start over
 * from their version. `mutate` may return `false` to leave the poll as is.
 */
async function mutatePoll(slugOrId, mutate) {
  const store = pollStore();
  for (let attempt = 0; attempt < EDIT_ATTEMPTS; attempt += 1) {
    const current = await store.findPoll(slugOrId);
    if (!current) throw httpError(404, "Poll not found.");
    const draft = structuredClone(current);
    if ((await mutate(draft, current)) === false) return current;
    draft.updatedAt = new Date().toISOString();
    const saved = await store.savePoll(draft, { previousId: current.id });
    if (saved) {
      forgetSnapshots();
      return saved;
    }
  }
  throw httpError(409, "Someone else just changed this poll. Try again.");
}

function canManagePolls(person) {
  if (!person) return false;
  const roles =
    Array.isArray(person.roleTypes) && person.roleTypes.length
      ? person.roleTypes
      : parseRoleTypes(person.roleType);
  return roles.includes(TEAM_ROLE);
}

async function lookupStaffPerson(personId) {
  const { isLocalMockMode } = require("./local-storage");
  if (isLocalMockMode()) {
    const { getLocalDatabase } = require("./local-storage");
    const db = await getLocalDatabase();
    return (db.people || []).find((p) => p.id === personId) || null;
  }
  const { loadRealDataRecords } = require("./realdata-store");
  const { records } = await loadRealDataRecords({ write: false });
  return records.find((r) => r.person?.id === personId)?.person || null;
}

async function requireStaff(session, verb) {
  const person = await lookupStaffPerson(session.personId);
  if (!canManagePolls(person)) throw httpError(403, `Only Foresight Team can ${verb} polls.`);
  return person;
}

function adminPollShape(poll, ballots) {
  return {
    ...publicPollShape(poll, ballots, null, { reveal: true, asOf: new Date().toISOString() }),
    createdByPersonId: poll.createdByPersonId,
    createdByName: poll.createdByName,
    ballotStats: ballotStats(poll, ballots),
  };
}

/* ── Reads ── */

async function listAdminPolls(session) {
  const person = session?.personId ? await lookupStaffPerson(session.personId) : null;
  const store = pollStore();
  const listed = await store.listPolls();
  const polls = await Promise.all(listed.map(async (poll) => (await settle(poll)) || poll));
  const ballots = await store.listBallots(polls.map((poll) => poll.id));
  return {
    canManage: canManagePolls(person),
    polls: polls.map((poll) =>
      adminPollShape(
        poll,
        ballots.filter((ballot) => ballot.pollId === poll.id),
      ),
    ),
  };
}

/** The ballot this phone (or judge seat) holds, if any. */
function yoursIn(ballots, voterKeys) {
  const keys = new Set(voterKeys);
  return (
    ballots
      .filter((ballot) => keys.has(ballot.voterKey))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || null
  );
}

/**
 * @param {string} slug
 * @param {{ knownKeys: string[] }} voter  from resolveVoter()
 * @param {{ judgeToken?: string }} [opts]
 */
async function getPublicPoll(slug, voter, { judgeToken } = {}) {
  const { at, poll, ballots } = await readSnapshot(slug);
  const judge = verifyJudgeToken(poll.slug, judgeToken);
  const keys = judge ? [judgeBallotKey(judge.seat)] : voter?.knownKeys || [];
  return publicPollShape(poll, ballots, yoursIn(ballots, keys), {
    reveal: poll.status === "live" || poll.status === "closed",
    asOf: new Date(at).toISOString(),
  });
}

/* ── Voting ── */

function pickOption(poll, id) {
  const key = String(id || "").trim();
  return poll.options.find((option) => option.id === key) || null;
}

/**
 * One phone, one ballot. The ballot row is found by any key this phone has
 * ever used and overwritten in place, so a resubmit changes picks, never
 * the count.
 */
async function castVote(input, voter, req) {
  const network = rateLimit(`poll-vote:ip:${clientIp(req)}`, {
    /* A whole room shares one address. */
    limit: 4000,
    windowMs: 15 * 60 * 1000,
  });
  const phone = rateLimit(`poll-vote:phone:${voter.ballotKey}`, {
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (!network.ok || !phone.ok) {
    throw httpError(429, "That's a lot of ballots at once. Wait a moment and try again.");
  }

  /* The snapshot is enough to validate picks; the write itself re-checks "live". */
  const snapshot = await readSnapshot(input.slug);
  const { poll } = snapshot;
  if (poll.status !== "live") {
    throw httpError(
      400,
      poll.status === "closed" ? "This poll has closed." : "Voting isn’t open yet. You can still add a project.",
    );
  }

  const judge = verifyJudgeToken(poll.slug, input.judgeToken);
  const first = pickOption(poll, input.firstId);
  const second = pickOption(poll, input.secondId);
  const third = pickOption(poll, input.thirdId);
  if (!first || !second || !third) {
    throw httpError(
      400,
      judge ? "Give 3, 2, and 1 points to three projects." : "Give 3, 2, and 1 points to three other teams.",
    );
  }
  if (new Set([first.id, second.id, third.id]).size !== 3) {
    throw httpError(400, "Pick three different projects.");
  }

  const teamInput = String(input.teamOptionId || "").trim();
  let ballot;
  if (judge) {
    ballot = {
      voterKey: judgeBallotKey(judge.seat),
      kind: "judge",
      personId: judgeBallotKey(judge.seat),
      teamOptionId: "",
    };
  } else {
    const guest = teamInput === GUEST_TEAM;
    const team = guest ? null : pickOption(poll, teamInput);
    if (!guest && !team) throw httpError(400, "Select your team.");
    if (team && [first.id, second.id, third.id].includes(team.id)) {
      throw httpError(400, "You can't vote for your own team.");
    }
    ballot = {
      voterKey: voter.ballotKey,
      kind: guest ? "guest" : "room",
      personId: "",
      teamOptionId: guest ? GUEST_TEAM : team.id,
    };
  }

  const saved = await pollStore().castBallot(
    { ...ballot, pollId: poll.id, firstId: first.id, secondId: second.id, thirdId: third.id },
    {
      knownKeys: judge ? [ballot.voterKey] : voter.knownKeys,
      deviceHint: judge ? "" : voter.hint,
    },
  );
  if (!saved) {
    forgetSnapshots();
    throw httpError(400, "This poll has closed.");
  }

  /*
   * The voter's own screen includes their ballot straight away. The shared
   * snapshot is left as read, so its timestamp stays honest; it refreshes
   * within a second and a half.
   */
  const ballots = [...snapshot.ballots.filter((row) => row.voterKey !== saved.voterKey), saved];
  return publicPollShape(poll, ballots, saved, {
    reveal: false,
    asOf: new Date(snapshot.at).toISOString(),
  });
}

/* ── Slate edits ── */

async function createPoll(session, body) {
  const person = await requireStaff(session, "create");
  const store = pollStore();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const slug = randomSlug();
    const now = new Date().toISOString();
    try {
      const poll = await store.insertPoll({
        id: `poll-${slug}`,
        slug,
        eventId: String(body.eventId || "").trim(),
        eventTitle: String(body.eventTitle || "").trim(),
        question: normalizeQuestion(body.question),
        options: normalizeOptions(body.options),
        status: "draft",
        createdByPersonId: session.personId,
        createdByName: person.fullName || session.fullName || "",
        createdAt: now,
        updatedAt: now,
      });
      return adminPollShape(poll, []);
    } catch (err) {
      if (err.code !== "23505") throw err;
    }
  }
  throw httpError(503, "Could not find a free poll code. Try again.");
}

function rotateForReset(draft) {
  draft.id = `poll-${draft.slug}-${Date.now().toString(36)}`;
  draft.status = "draft";
  draft.options = [];
  draft.closedAt = "";
  draft.closesAt = "";
}

function applyStatus(draft, next) {
  if (!STATUSES.has(next)) throw httpError(400, "Status must be draft, live, or closed.");
  if (draft.status === "closed" && next !== "closed") {
    throw httpError(400, "Closed polls stay in the archive. Create a new poll to run it again.");
  }
  if (draft.status === "draft" && next === "closed") {
    throw httpError(400, "Go live before closing, or leave it as a draft.");
  }
  if (next === "live" && draft.options.length < MIN_LIVE_OPTIONS) {
    throw httpError(400, "Add at least four projects before voting opens.");
  }
  const now = new Date().toISOString();
  draft.status = next;
  if (next === "live") draft.closesAt = "";
  if (next === "closed") {
    draft.closedAt = now;
    draft.closesAt = "";
  }
}

async function closeOtherLivePolls(keepId) {
  const others = (await pollStore().listPolls()).filter(
    (poll) => poll.id !== keepId && poll.status === "live",
  );
  for (const other of others) {
    await mutatePoll(other.id, (draft) => {
      if (draft.status !== "live") return false;
      draft.status = "closed";
      draft.closedAt = new Date().toISOString();
      draft.closesAt = "";
    });
  }
}

async function updatePoll(session, body) {
  await requireStaff(session, "edit");
  const target = body.slug || body.id;

  if (body.status === "live" && body.closeOtherLive) {
    const current = await pollStore().findPoll(target);
    if (current) await closeOtherLivePolls(current.id);
  }

  const saved = await mutatePoll(target, (draft) => {
    if (body.reset) {
      rotateForReset(draft);
      return;
    }
    if (body.removeOptionId) {
      if (draft.status !== "draft") {
        throw httpError(400, "You can only remove a project before voting opens.");
      }
      const removeId = String(body.removeOptionId).trim();
      const kept = draft.options.filter((option) => option.id !== removeId);
      if (kept.length === draft.options.length) {
        throw httpError(400, "That project is not on this poll.");
      }
      draft.options = kept;
    }
    const addOption = body.addOption ?? body.appendOption ?? null;
    if (addOption != null) {
      if (draft.status === "closed") {
        throw httpError(400, "Closed polls can’t gain new projects. Open a new poll.");
      }
      draft.options = appendProject(
        draft.options,
        typeof addOption === "string" ? { label: addOption } : addOption,
      );
    }
    if (body.question != null || body.options != null) {
      if (draft.status !== "draft") {
        throw httpError(
          400,
          "Question and the full project list can only change while the poll is a draft. " +
            "On a live poll, add one project at a time.",
        );
      }
      if (body.question != null) draft.question = normalizeQuestion(body.question);
      if (body.options != null) draft.options = normalizeOptions(body.options, draft.options);
    }
    if (body.eventId != null) draft.eventId = String(body.eventId || "").trim();
    if (body.eventTitle != null) draft.eventTitle = String(body.eventTitle || "").trim();
    if (body.finalMinute) {
      if (draft.status !== "live") throw httpError(400, "Voting has to be open.");
      draft.closesAt = new Date(Date.now() + FINAL_MINUTE_MS).toISOString();
    }
    if (body.status) applyStatus(draft, String(body.status).trim());
  });

  const ballots = await pollStore().listBallots([saved.id]);
  return adminPollShape(saved, ballots);
}

/**
 * A pitcher adds their own project while submissions are open. The room
 * shares Wi-Fi, so the network cap stays high enough for a full lab.
 */
async function addProject(body, req, voter) {
  const network = rateLimit(`poll-add:ip:${clientIp(req)}`, {
    limit: 80,
    windowMs: 60 * 60 * 1000,
  });
  if (!network.ok) throw httpError(429, "Too many projects from this network. Ask the host to add it.");
  const phone = rateLimit(`poll-add:phone:${voter.ballotKey}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!phone.ok) {
    throw httpError(429, "This phone has added enough projects. Ask the host if one is missing.");
  }

  const label = String(body.label || body.name || "").trim();
  const people = cleanPeople(body.people);
  const url = cleanGithubRepo(body.url);

  const saved = await mutatePoll(body.slug || body.id, (draft) => {
    if (draft.status === "closed") throw httpError(400, "This poll is closed.");
    if (draft.options.some((option) => sameLabel(option.label, label))) return false;
    draft.options = appendProject(draft.options, { label, people, url });
  });

  const ballots = await pollStore().listBallots([saved.id]);
  return publicPollShape(saved, ballots, yoursIn(ballots, voter.knownKeys), {
    reveal: false,
    asOf: new Date().toISOString(),
  });
}

/* ── Ops helpers (scripts) ── */

/** Same wipe as the admin Reset button, no session. */
async function resetPollBySlug(slug) {
  const poll = await mutatePoll(slug, rotateForReset);
  return { slug: poll.slug, id: poll.id, status: poll.status };
}

/** Idempotent room poll for a known event. An existing slug is left alone. */
async function ensureEventPoll({ slug, eventTitle, question, options, status }) {
  const store = pollStore();
  if (await store.findPoll(slug)) return { slug, created: false };
  const now = new Date().toISOString();
  await store.insertPoll({
    id: `poll-${slug}`,
    slug,
    eventTitle,
    question,
    options: options.map((label, index) => ({ id: String(index + 1), label, people: "", url: "" })),
    status,
    createdByName: "Foresight",
    createdAt: now,
    updatedAt: now,
  });
  return { slug, created: true, status };
}

/** Point an untouched draft at a best-project ballot. Never touches a voted poll. */
async function refreshBestProjectDraft({ slug, question }) {
  const store = pollStore();
  const poll = await store.findPoll(slug);
  if (!poll) return { slug, updated: false, reason: "missing" };
  if (poll.status !== "draft") return { slug, updated: false, reason: poll.status };
  if ((await store.listBallots([poll.id])).length) return { slug, updated: false, reason: "has-votes" };
  await mutatePoll(slug, (draft) => {
    draft.question = normalizeQuestion(question);
    draft.options = [];
  });
  return { slug, updated: true };
}

/** Sample projects + open voting, to look at the vote page before the real slate. */
async function installPreviewSlate({ slug, eventTitle, question, projects }) {
  const poll = await mutatePoll(slug, (draft) => {
    draft.eventTitle = eventTitle;
    draft.question = normalizeQuestion(question);
    draft.options = projects.map((project, index) => ({
      id: String(index + 1),
      label: String(project.label).trim(),
      people: String(project.people || "").trim(),
      url: project.url ? cleanUrl(project.url) : "",
    }));
    draft.status = "live";
    draft.closedAt = "";
  });
  return { slug, projects: poll.options.length, status: poll.status };
}

async function pingPollStore() {
  await pollStore().ping();
}

module.exports = {
  canManagePolls,
  listAdminPolls,
  getPublicPoll,
  createPoll,
  updatePoll,
  castVote,
  addProject,
  hashVoterKey,
  tallyVotes,
  ensureEventPoll,
  refreshBestProjectDraft,
  installPreviewSlate,
  resetPollBySlug,
  listJudgeLinks,
  verifyJudgeToken,
  pingPollStore,
  JUDGE_SEATS,
};
