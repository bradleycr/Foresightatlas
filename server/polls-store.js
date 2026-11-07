/**
 * Event polls — Google Sheet (Polls + PollVotes) or local mock files.
 *
 * Designed like Mentimeter / Slido: a short slug in a QR lands a phone on a
 * one-question vote screen. Votes are append-only; the latest row for
 * (pollId, voterKey) wins so someone can change their mind while the poll
 * is live. Draft → live → closed. Closed polls stay in the archive.
 */

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credPath && !fs.existsSync(path.resolve(credPath))) {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const { google } = require("googleapis");
const {
  getSpreadsheetId,
  SHEET_NAMES,
  POLLS_HEADERS,
  POLL_VOTES_HEADERS,
  getSheetColumnLetter,
} = require("../scripts/sheet-schema.js");
const { parseRoleTypes } = require("./role-types");
const { isLocalMockMode } = require("./local-storage");

const { rateLimit } = require("./rate-limit");

const TEAM_ROLE = "Foresight Team";
const STATUSES = new Set(["draft", "live", "closed"]);
const SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const MAX_OPTIONS = 48;
const MIN_LIVE_OPTIONS = 4;
const MAX_QUESTION = 200;
const MAX_OPTION = 120;
const MAX_PEOPLE = 160;
const MAX_URL = 400;
const FIRST_POINTS = 3;
const SECOND_POINTS = 2;
const THIRD_POINTS = 1;

function sheetsId() {
  return getSpreadsheetId();
}

function hashVoterKey(raw) {
  const secret =
    process.env.DIRECTORY_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    "foresight-atlas-dev";
  return crypto
    .createHash("sha256")
    .update(`${secret}:poll-voter:${String(raw || "").trim()}`)
    .digest("hex")
    .slice(0, 32);
}

function randomSlug(length = 6) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return out;
}

function colIndex(headerRow, name) {
  return headerRow.findIndex((c) => String(c).trim().toLowerCase() === name.toLowerCase());
}

function cell(row, headerRow, name) {
  const i = colIndex(headerRow, name);
  if (i < 0) return "";
  return row[i] != null ? String(row[i]).trim() : "";
}

function parseOptions(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => {
        if (item && typeof item === "object") {
          const id = String(item.id || "").trim() || optionIdFromIndex(index);
          const label = String(item.label || "").trim();
          if (!label) return null;
          return {
            id,
            label,
            people: String(item.people || "").trim(),
            url: String(item.url || "").trim(),
          };
        }
        const label = String(item || "").trim();
        return label ? { id: optionIdFromIndex(index), label, people: "", url: "" } : null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function optionIdFromIndex(index) {
  return String(index + 1);
}

function cleanPeople(raw) {
  const people = String(raw || "").replace(/\s+/g, " ").trim();
  if (people.length > MAX_PEOPLE) {
    throw new Error(`Keep the names under ${MAX_PEOPLE} characters.`);
  }
  const parts = people
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Add at least two names, separated by commas.");
  }
  return parts.join(", ");
}

/**
 * A GitHub repo only. Accepts:
 *   https://github.com/org/project
 *   github.com/org/project
 *   www.github.com/org/project
 *   org/project
 * Extra path (/tree/…, /blob/…, .git) is trimmed to the repo root.
 */
function cleanGithubRepo(raw) {
  let value = String(raw || "")
    .trim()
    .replace(/^[\s"'`“”‘’<]+|[\s"'`“”‘’>]+$/g, "")
    .replace(/\s+/g, "");
  if (!value) throw new Error("Add the GitHub repo.");

  /* Paste from chat sometimes includes the @ of an @mention. */
  value = value.replace(/^@/, "");

  /* git@github.com:org/repo(.git) → https */
  const ssh = value.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (ssh) value = `https://github.com/${ssh[1]}/${ssh[2]}`;

  if (!/^https?:\/\//i.test(value)) {
    if (/^(www\.)?github\.com\//i.test(value)) {
      value = `https://${value.replace(/^www\./i, "")}`;
    } else if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.test(value)) {
      value = `https://github.com/${value.replace(/^\/+/, "")}`;
    } else {
      throw new Error("Use github.com/org/project — or just org/project.");
    }
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Use github.com/org/project — or just org/project.");
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "github.com") {
    throw new Error("Only GitHub repos work here (github.com/org/project).");
  }
  const [owner, repo] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repo) {
    throw new Error("Needs org and repo — e.g. github.com/anthropics/claude-code");
  }
  const cleanRepo = repo.replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(cleanRepo)) {
    throw new Error("That doesn’t look like a GitHub owner/repo.");
  }
  return `https://github.com/${owner}/${cleanRepo}`;
}

/** http(s) only. A bare domain gets https:// so a pitch link still opens. */
function cleanUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  const withProto = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url;
  try {
    url = new URL(withProto);
  } catch {
    throw new Error("That link doesn’t look right.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The link needs to be a normal web address.");
  }
  if (url.href.length > MAX_URL) {
    throw new Error("That link is too long.");
  }
  return url.href;
}

function projectFromInput(item, previous = []) {
  const label =
    typeof item === "string"
      ? item.trim()
      : String(item?.label || "").trim();
  if (!label) return null;
  if (label.length < 2) throw new Error("Project name needs at least 2 characters.");
  if (label.length > MAX_OPTION) {
    throw new Error(`Each project name must be ${MAX_OPTION} characters or fewer.`);
  }
  const prev = previous.find(
    (option) => String(option.label || "").trim().toLowerCase() === label.toLowerCase(),
  );
  const people =
    item && typeof item === "object" && item.people != null
      ? cleanPeople(item.people)
      : cleanPeople(prev?.people || "");
  const url =
    item && typeof item === "object" && item.url != null
      ? cleanUrl(item.url)
      : String(prev?.url || "");
  return { label, people, url };
}

function normalizeOptions(input, previous = []) {
  const list = Array.isArray(input) ? input : [];
  const options = [];
  const seen = new Set();
  for (const item of list) {
    const project = projectFromInput(item, previous);
    if (!project) continue;
    const key = project.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ id: optionIdFromIndex(options.length), ...project });
  }
  if (options.length > MAX_OPTIONS) {
    throw new Error(`Keep it to ${MAX_OPTIONS} projects or fewer.`);
  }
  return options;
}

/**
 * Append one project without renumbering existing ids — votes already point
 * at those ids. Draft submissions and a host's late add both come through here.
 */
function appendProject(existing, project) {
  const label = String(project?.label || "").trim();
  const people = cleanPeople(project?.people);
  const url = cleanUrl(project?.url);
  if (label.length < 2) throw new Error("Project name needs at least 2 characters.");
  if (label.length > MAX_OPTION) {
    throw new Error(`Each project name must be ${MAX_OPTION} characters or fewer.`);
  }
  const options = Array.isArray(existing) ? [...existing] : [];
  if (options.length >= MAX_OPTIONS) {
    throw new Error(`Keep it to ${MAX_OPTIONS} projects or fewer.`);
  }
  const dup = options.some(
    (option) => String(option.label || "").trim().toLowerCase() === label.toLowerCase(),
  );
  if (dup) throw new Error("That project is already on this poll.");

  let maxId = 0;
  for (const option of options) {
    const n = Number.parseInt(String(option.id), 10);
    if (Number.isFinite(n) && n > maxId) maxId = n;
  }
  options.push({ id: String(maxId + 1), label, people, url });
  return options;
}

function clientIp(req) {
  const forwarded = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return String(forwarded || req?.socket?.remoteAddress || "unknown").slice(0, 80);
}

function normalizeQuestion(value) {
  const question = String(value || "").trim();
  if (!question) throw new Error("A question is required.");
  if (question.length > MAX_QUESTION) {
    throw new Error(`Keep the question under ${MAX_QUESTION} characters.`);
  }
  return question;
}

function pollFromRow(row, headerRow, rowNumber) {
  const id = cell(row, headerRow, "id");
  const slug = cell(row, headerRow, "slug");
  if (!id && !slug) return null;
  const statusRaw = cell(row, headerRow, "status") || "draft";
  const status = STATUSES.has(statusRaw) ? statusRaw : "draft";
  return {
    id: id || `poll-${slug}`,
    slug: slug || id,
    eventId: cell(row, headerRow, "eventId"),
    eventTitle: cell(row, headerRow, "eventTitle"),
    question: cell(row, headerRow, "question"),
    options: parseOptions(cell(row, headerRow, "options")),
    status,
    createdByPersonId: cell(row, headerRow, "createdByPersonId"),
    createdByName: cell(row, headerRow, "createdByName"),
    createdAt: cell(row, headerRow, "createdAt"),
    updatedAt: cell(row, headerRow, "updatedAt"),
    closedAt: cell(row, headerRow, "closedAt"),
    closesAt: cell(row, headerRow, "closesAt"),
    rowNumber,
  };
}

function pollToRow(poll) {
  return [
    poll.id,
    poll.slug,
    poll.eventId || "",
    poll.eventTitle || "",
    poll.question,
    JSON.stringify(poll.options),
    poll.status,
    poll.createdByPersonId || "",
    poll.createdByName || "",
    poll.createdAt,
    poll.updatedAt,
    poll.closedAt || "",
    poll.closesAt || "",
  ];
}

function latestBallots(poll, votes) {
  const latest = new Map();
  for (const vote of votes) {
    if (vote.pollId !== poll.id) continue;
    latest.set(vote.voterKey, vote);
  }
  return [...latest.values()];
}

/**
 * Truncated Borda: 3, then 2, then 1. A phone cannot award its own team.
 * Ties break on more 3-point picks, then 2-point, then 1-point. One phone
 * is one ballot — the latest row for that device replaces the earlier one.
 */
function awardedIds(vote, score) {
  const team = String(vote.teamOptionId || "");
  if (!team || !score[team]) return null;
  const seen = new Set([team]);
  const picks = [];
  for (const id of [vote.optionId, vote.secondOptionId, vote.thirdOptionId]) {
    const key = String(id || "");
    if (!key || seen.has(key) || !score[key]) return null;
    seen.add(key);
    picks.push(key);
  }
  return picks;
}

function tallyVotes(poll, votes) {
  const score = {};
  for (const option of poll.options) {
    score[option.id] = { points: 0, firsts: 0, seconds: 0, thirds: 0 };
  }
  let totalBallots = 0;
  for (const vote of latestBallots(poll, votes)) {
    const picks = awardedIds(vote, score);
    if (!picks) continue;
    const [first, second, third] = picks;
    totalBallots += 1;
    score[first].points += FIRST_POINTS;
    score[first].firsts += 1;
    score[second].points += SECOND_POINTS;
    score[second].seconds += 1;
    score[third].points += THIRD_POINTS;
    score[third].thirds += 1;
  }
  const ranked = poll.options.map((option) => ({
    ...option,
    points: score[option.id].points,
    firsts: score[option.id].firsts,
    seconds: score[option.id].seconds,
    thirds: score[option.id].thirds,
    votes: score[option.id].points,
  }));
  ranked.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.firsts !== a.firsts) return b.firsts - a.firsts;
    if (b.seconds !== a.seconds) return b.seconds - a.seconds;
    if (b.thirds !== a.thirds) return b.thirds - a.thirds;
    return a.label.localeCompare(b.label);
  });
  ranked.forEach((row, index) => {
    const prev = ranked[index - 1];
    const tied =
      prev &&
      prev.points === row.points &&
      prev.firsts === row.firsts &&
      prev.seconds === row.seconds &&
      prev.thirds === row.thirds;
    row.place = tied ? prev.place : index + 1;
  });
  return { ranked, totalBallots };
}

function publicOption(option) {
  return {
    id: option.id,
    label: option.label,
    people: option.people || "",
    url: option.url || "",
  };
}

function publicPollShape(poll, votes, yours, { reveal } = {}) {
  const show = Boolean(reveal);
  const { ranked, totalBallots } = tallyVotes(poll, votes);
  const firstId = yours?.firstId || null;
  const secondId = yours?.secondId || null;
  const thirdId = yours?.thirdId || null;
  const teamId = yours?.teamId || null;
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
    // Hidden until the host closes, so a live room isn't pulled onto an early lead.
    results: show ? ranked.map(publicOption).map((option, index) => ({
      ...option,
      points: ranked[index].points,
      firsts: ranked[index].firsts,
      seconds: ranked[index].seconds,
      thirds: ranked[index].thirds,
      votes: ranked[index].points,
      place: ranked[index].place,
    })) : [],
    scoresHidden: !show,
    totalVotes: totalBallots,
    yourOptionId: firstId,
    yourFirstId: firstId,
    yourSecondId: secondId,
    yourThirdId: thirdId,
    yourTeamId: teamId,
  };
}

function adminPollShape(poll, votes) {
  const publicShape = publicPollShape(poll, votes, null, { reveal: true });
  return {
    ...publicShape,
    createdByPersonId: poll.createdByPersonId,
    createdByName: poll.createdByName,
  };
}

function canManagePolls(person) {
  if (!person) return false;
  const roles = Array.isArray(person.roleTypes) && person.roleTypes.length
    ? person.roleTypes
    : parseRoleTypes(person.roleType);
  return roles.includes(TEAM_ROLE);
}

async function getSheetsClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let key = null;
  if (keyJson) {
    try {
      key = JSON.parse(keyJson);
    } catch {
      return null;
    }
  } else if (keyPath) {
    const resolved = path.resolve(keyPath);
    if (fs.existsSync(resolved)) {
      try {
        key = JSON.parse(fs.readFileSync(resolved, "utf8"));
      } catch {
        return null;
      }
    }
  }
  if (!key) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

const ensuredTabs = new Set();

async function ensureTab(sheets, title, headers) {
  if (ensuredTabs.has(title)) return;
  const spreadsheetId = sheetsId();
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const exists = (data.sheets || []).some(
    (s) => String(s?.properties?.title || "") === title,
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });
  }
  const lastCol = String.fromCharCode(64 + headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1:${lastCol}1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  });
  ensuredTabs.add(title);
}

async function loadSheetPollsAndVotes(sheets) {
  const spreadsheetId = sheetsId();
  await ensureTab(sheets, SHEET_NAMES.POLLS, POLLS_HEADERS);
  await ensureTab(sheets, SHEET_NAMES.POLL_VOTES, POLL_VOTES_HEADERS);

  const [pollsRes, votesRes] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAMES.POLLS}'`,
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAMES.POLL_VOTES}'`,
    }),
  ]);

  const pollValues = pollsRes.data.values || [];
  const voteValues = votesRes.data.values || [];
  const pollHeader = pollValues[0] || POLLS_HEADERS;
  const voteHeader = voteValues[0] || POLL_VOTES_HEADERS;

  const polls = [];
  for (let i = 1; i < pollValues.length; i += 1) {
    const poll = pollFromRow(pollValues[i], pollHeader, i + 1);
    if (poll) polls.push(poll);
  }

  const votes = [];
  for (let i = 1; i < voteValues.length; i += 1) {
    const row = voteValues[i];
    const pollId = cell(row, voteHeader, "pollId");
    const voterKey = cell(row, voteHeader, "voterKey");
    const optionId = cell(row, voteHeader, "optionId");
    if (!pollId || !voterKey || !optionId) continue;
    votes.push({
      pollId,
      voterKey,
      personId: cell(row, voteHeader, "personId"),
      fullName: cell(row, voteHeader, "fullName"),
      optionId,
      secondOptionId: cell(row, voteHeader, "secondOptionId"),
      thirdOptionId: cell(row, voteHeader, "thirdOptionId"),
      teamOptionId: cell(row, voteHeader, "teamOptionId"),
      createdAt: cell(row, voteHeader, "createdAt"),
      updatedAt: cell(row, voteHeader, "updatedAt"),
      rowNumber: i + 1,
    });
  }

  return { polls, votes };
}

async function loadMockPollsAndVotes() {
  const { getLocalDatabase } = require("./local-storage");
  const db = await getLocalDatabase();
  return {
    polls: Array.isArray(db.polls) ? db.polls : [],
    votes: Array.isArray(db.pollVotes) ? db.pollVotes : [],
  };
}

/** A room of phones shares one sheet read. Writes drop the cache immediately. */
let pollCache = { at: 0, value: null };
const POLL_CACHE_MS = 4000;

function dropPollCache() {
  pollCache = { at: 0, value: null };
}

async function loadAll() {
  if (isLocalMockMode()) return loadMockPollsAndVotes();
  const now = Date.now();
  if (pollCache.value && now - pollCache.at < POLL_CACHE_MS) return pollCache.value;
  const sheets = await getSheetsClient();
  if (!sheets) throw new Error("Google Sheets write credentials are not configured.");
  const value = await loadSheetPollsAndVotes(sheets);
  pollCache = { at: Date.now(), value };
  return value;
}

async function persistPoll(poll) {
  if (isLocalMockMode()) {
    const { upsertLocalPoll } = require("./local-storage");
    return upsertLocalPoll(poll);
  }
  const sheets = await getSheetsClient();
  if (!sheets) throw new Error("Google Sheets write credentials are not configured.");
  const spreadsheetId = sheetsId();
  await ensureTab(sheets, SHEET_NAMES.POLLS, POLLS_HEADERS);
  const { polls } = await loadSheetPollsAndVotes(sheets);
  const existing = polls.find((p) => p.id === poll.id || p.slug === poll.slug);
  const row = pollToRow(poll);
  const lastCol = getSheetColumnLetter(POLLS_HEADERS.length - 1);
  if (existing?.rowNumber) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${SHEET_NAMES.POLLS}'!A${existing.rowNumber}:${lastCol}${existing.rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${SHEET_NAMES.POLLS}'!A:${lastCol}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }
  dropPollCache();
  return poll;
}

async function persistVote(vote) {
  if (isLocalMockMode()) {
    const { appendLocalPollVote } = require("./local-storage");
    return appendLocalPollVote(vote);
  }
  const sheets = await getSheetsClient();
  if (!sheets) throw new Error("Google Sheets write credentials are not configured.");
  const spreadsheetId = sheetsId();
  await ensureTab(sheets, SHEET_NAMES.POLL_VOTES, POLL_VOTES_HEADERS);
  const lastCol = getSheetColumnLetter(POLL_VOTES_HEADERS.length - 1);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${SHEET_NAMES.POLL_VOTES}'!A:${lastCol}`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        vote.pollId,
        vote.voterKey,
        vote.personId || "",
        vote.fullName || "",
        vote.optionId,
        vote.createdAt,
        vote.updatedAt,
        vote.secondOptionId || "",
        vote.thirdOptionId || "",
        vote.teamOptionId || "",
      ]],
    },
  });
  dropPollCache();
  return vote;
}

async function lookupStaffPerson(personId) {
  if (isLocalMockMode()) {
    const { getLocalDatabase } = require("./local-storage");
    const db = await getLocalDatabase();
    return (db.people || []).find((p) => p.id === personId) || null;
  }
  const { loadRealDataRecords } = require("./realdata-store");
  const { records } = await loadRealDataRecords({ write: false });
  const match = records.find((r) => r.person?.id === personId);
  return match?.person || null;
}

const FINAL_MINUTE_MS = 60 * 1000;

/** A live poll with a deadline in the past becomes closed on the next read. */
async function settleDuePolls(polls) {
  const now = Date.now();
  for (const poll of polls) {
    if (poll.status !== "live" || !poll.closesAt) continue;
    const due = Date.parse(poll.closesAt);
    if (!Number.isFinite(due) || due > now) continue;
    poll.status = "closed";
    poll.closedAt = new Date(due).toISOString();
    poll.updatedAt = new Date(now).toISOString();
    await persistPoll(poll);
  }
}

function findPoll(polls, slugOrId) {
  const key = String(slugOrId || "").trim().toLowerCase();
  if (!key) return null;
  return (
    polls.find((p) => String(p.slug).toLowerCase() === key) ||
    polls.find((p) => String(p.id).toLowerCase() === key) ||
    null
  );
}

async function listAdminPolls(session) {
  const person = session?.personId ? await lookupStaffPerson(session.personId) : null;
  const manage = canManagePolls(person);
  const { polls, votes } = await loadAll();
  await settleDuePolls(polls);
  const sorted = [...polls].sort((a, b) =>
    String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)),
  );
  return {
    canManage: manage,
    polls: sorted.map((poll) => adminPollShape(poll, votes)),
  };
}

async function getPublicPoll(slug, voterKeyRaw) {
  const { polls, votes } = await loadAll();
  const poll = findPoll(polls, slug);
  if (!poll) {
    const err = new Error("This poll is not available.");
    err.statusCode = 404;
    throw err;
  }
  await settleDuePolls([poll]);
  const voterKey = voterKeyRaw ? hashVoterKey(voterKeyRaw) : "";
  const yours = ballotFor(poll, votes, voterKey);
  return publicPollShape(poll, votes, yours, {
    reveal: poll.status === "live" || poll.status === "closed",
  });
}

function ballotFor(poll, votes, voterKey) {
  if (!voterKey) return null;
  const latest = [...votes].reverse().find(
    (vote) => vote.pollId === poll.id && vote.voterKey === voterKey,
  );
  if (!latest) return null;
  return {
    firstId: latest.optionId || null,
    secondId: latest.secondOptionId || null,
    thirdId: latest.thirdOptionId || null,
    teamId: latest.teamOptionId || null,
  };
}

async function createPoll(session, body) {
  const person = await lookupStaffPerson(session.personId);
  if (!canManagePolls(person)) {
    const err = new Error("Only Foresight Team can create polls.");
    err.statusCode = 403;
    throw err;
  }
  const { polls } = await loadAll();
  let slug = randomSlug();
  for (let i = 0; i < 6 && findPoll(polls, slug); i += 1) {
    slug = randomSlug();
  }
  const now = new Date().toISOString();
  const poll = {
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
    closedAt: "",
    closesAt: "",
  };
  await persistPoll(poll);
  return adminPollShape(poll, []);
}

async function updatePoll(session, body) {
  const person = await lookupStaffPerson(session.personId);
  if (!canManagePolls(person)) {
    const err = new Error("Only Foresight Team can edit polls.");
    err.statusCode = 403;
    throw err;
  }
  const { polls, votes } = await loadAll();
  const poll = findPoll(polls, body.slug || body.id);
  if (!poll) {
    const err = new Error("Poll not found.");
    err.statusCode = 404;
    throw err;
  }
  const now = new Date().toISOString();

  if (body.reset) {
    await applyPollReset(poll, now);
    return adminPollShape(poll, votes);
  }

  /*
   * Live polls may only grow: append a project name without renumbering ids.
   * Full question/options replace stays draft-only so existing votes stay valid.
   */
  const addOption =
    body.addOption != null
      ? body.addOption
      : body.appendOption != null
        ? body.appendOption
        : null;
  if (body.removeOptionId) {
    if (poll.status !== "draft") {
      throw new Error("You can only remove a project before voting opens.");
    }
    const removeId = String(body.removeOptionId).trim();
    const nextOptions = poll.options.filter((option) => option.id !== removeId);
    if (nextOptions.length === poll.options.length) {
      throw new Error("That project is not on this poll.");
    }
    poll.options = nextOptions;
  }

  if (addOption != null) {
    if (poll.status === "closed") {
      throw new Error("Closed polls can’t gain new projects. Open a new poll.");
    }
    const project = typeof addOption === "string" ? { label: addOption } : addOption;
    poll.options = appendProject(poll.options, project);
  }

  if (body.question != null || body.options != null) {
    if (poll.status !== "draft") {
      throw new Error(
        "Question and the full project list can only change while the poll is a draft. " +
          "On a live poll, add one project at a time.",
      );
    }
    if (body.question != null) poll.question = normalizeQuestion(body.question);
    if (body.options != null) poll.options = normalizeOptions(body.options, poll.options);
  }
  if (body.eventId != null) poll.eventId = String(body.eventId || "").trim();
  if (body.eventTitle != null) poll.eventTitle = String(body.eventTitle || "").trim();
  if (body.finalMinute) {
    if (poll.status !== "live") {
      throw new Error("Voting has to be open.");
    }
    poll.closesAt = new Date(Date.now() + FINAL_MINUTE_MS).toISOString();
  }
  if (body.status) {
    const next = String(body.status).trim();
    if (!STATUSES.has(next)) throw new Error("Status must be draft, live, or closed.");
    if (poll.status === "closed" && next !== "closed") {
      throw new Error("Closed polls stay in the archive. Create a new poll to run it again.");
    }
    if (poll.status === "draft" && next === "closed") {
      throw new Error("Go live before closing, or leave it as a draft.");
    }
    /*
     * Soft single-live: when going live, optionally close every other live
     * poll so the room isn’t split across two QR codes by accident.
     */
    if (next === "live" && poll.options.length < MIN_LIVE_OPTIONS) {
      throw new Error("Add at least four projects before voting opens.");
    }
    if (next === "live" && body.closeOtherLive) {
      for (const other of polls) {
        if (other.id === poll.id || other.status !== "live") continue;
        other.status = "closed";
        other.closedAt = now;
        other.updatedAt = now;
        await persistPoll(other);
      }
    }
    poll.status = next;
    if (next === "live") poll.closesAt = "";
    if (next === "closed") {
      poll.closedAt = now;
      poll.closesAt = "";
    }
  }
  poll.updatedAt = now;
  await persistPoll(poll);
  const { votes: freshVotes } = await loadAll();
  return adminPollShape(poll, freshVotes);
}

async function castVote({ slug, optionId, secondOptionId, thirdOptionId, teamOptionId, voterKeyRaw }, req) {
  const flood = rateLimit(`poll-vote:${clientIp(req)}`, {
    limit: 240,
    windowMs: 15 * 60 * 1000,
  });
  if (!flood.ok) {
    const err = new Error("Too many ballots from this network. Wait a minute and try again.");
    err.statusCode = 429;
    throw err;
  }

  const { polls, votes } = await loadAll();
  const poll = findPoll(polls, slug);
  if (!poll) {
    const err = new Error("Poll not found.");
    err.statusCode = 404;
    throw err;
  }
  await settleDuePolls([poll]);
  if (poll.status !== "live") {
    const err = new Error(
      poll.status === "closed"
        ? "This poll has closed."
        : "Voting isn’t open yet. You can still add a project.",
    );
    err.statusCode = 400;
    throw err;
  }
  const team = poll.options.find((option) => option.id === String(teamOptionId || "").trim());
  if (!team) throw new Error("Select your team.");
  const first = poll.options.find((option) => option.id === String(optionId || "").trim());
  const second = poll.options.find((option) => option.id === String(secondOptionId || "").trim());
  const third = poll.options.find((option) => option.id === String(thirdOptionId || "").trim());
  if (!first || !second || !third) throw new Error("Give 3, 2, and 1 points to three other teams.");
  const picks = new Set([first.id, second.id, third.id]);
  if (picks.size !== 3 || picks.has(team.id)) {
    throw new Error("You can't vote for your own team.");
  }

  const rawKey = String(voterKeyRaw || "").trim();
  if (!rawKey || rawKey.length < 8) {
    throw new Error("A voter key is required.");
  }
  const voterKey = hashVoterKey(rawKey);
  const now = new Date().toISOString();
  const previous = [...votes].reverse().find(
    (vote) => vote.pollId === poll.id && vote.voterKey === voterKey,
  );
  const vote = {
    pollId: poll.id,
    voterKey,
    personId: "",
    fullName: "",
    optionId: first.id,
    secondOptionId: second.id,
    thirdOptionId: third.id,
    teamOptionId: team.id,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
  await persistVote(vote);
  const nextVotes = [...votes, vote];
  return publicPollShape(
    poll,
    nextVotes,
    { firstId: first.id, secondId: second.id, thirdId: third.id, teamId: team.id },
    { reveal: false },
  );
}

/**
 * A pitcher adds their own project while the poll is still a draft.
 * One phone can submit a few (a team, a typo). The room shares Wi-Fi,
 * so the address cap stays high enough for a full lab.
 *
 * Sheet writes are last-write-wins on the whole options cell — if two phones
 * add at once, re-read and retry so nobody's project silently disappears.
 */
async function addProject(body, req) {
  const ip = clientIp(req);
  const ipLimit = rateLimit(`poll-add:ip:${ip}`, {
    limit: 80,
    windowMs: 60 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    const err = new Error("Too many projects from this network. Ask the host to add it.");
    err.statusCode = 429;
    throw err;
  }
  const rawKey = String(body.voterKey || "").trim();
  if (rawKey.length >= 8) {
    const deviceLimit = rateLimit(`poll-add:device:${hashVoterKey(rawKey)}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!deviceLimit.ok) {
      const err = new Error("This phone has added enough projects. Ask the host if one is missing.");
      err.statusCode = 429;
      throw err;
    }
  }

  const people = cleanPeople(body.people);
  if (people.length < 2) {
    throw new Error("Add the names, separated by commas.");
  }
  const label = String(body.label || body.name || "").trim();
  const url = cleanGithubRepo(body.url);
  const labelKey = label.toLowerCase();
  const voterKey = rawKey.length >= 8 ? hashVoterKey(rawKey) : "";
  const slugOrId = body.slug || body.id;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    dropPollCache();
    const { polls, votes } = await loadAll();
    const poll = findPoll(polls, slugOrId);
    if (!poll) {
      const err = new Error("Poll not found.");
      err.statusCode = 404;
      throw err;
    }
    await settleDuePolls([poll]);
    if (poll.status === "closed") {
      const err = new Error("This poll is closed.");
      err.statusCode = 400;
      throw err;
    }
    if (poll.options.some((option) => String(option.label || "").trim().toLowerCase() === labelKey)) {
      return publicPollShape(poll, votes, ballotFor(poll, votes, voterKey), { reveal: false });
    }
    poll.options = appendProject(poll.options, { label, people, url });
    poll.updatedAt = new Date().toISOString();
    await persistPoll(poll);
    dropPollCache();
    const { polls: checkPolls, votes: checkVotes } = await loadAll();
    const verified = findPoll(checkPolls, slugOrId);
    if (
      verified &&
      verified.options.some((option) => String(option.label || "").trim().toLowerCase() === labelKey)
    ) {
      return publicPollShape(verified, checkVotes, ballotFor(verified, checkVotes, voterKey), {
        reveal: false,
      });
    }
  }
  const err = new Error("The slate is busy — tap Add project once more.");
  err.statusCode = 503;
  throw err;
}

/**
 * Reopen as a blank draft. Slug (add/vote/QR URLs) stays. poll.id rotates so
 * earlier ballots — keyed by the old id — do not tally on the next slate.
 */
async function applyPollReset(poll, now = new Date().toISOString()) {
  poll.id = `poll-${poll.slug}-${Date.now().toString(36)}`;
  poll.status = "draft";
  poll.options = [];
  poll.closedAt = "";
  poll.closesAt = "";
  poll.updatedAt = now;
  await persistPoll(poll);
  return poll;
}

/** Script / ops helper — same wipe as the admin Reset button, no session. */
async function resetPollBySlug(slug) {
  const { polls } = await loadAll();
  const poll = findPoll(polls, slug);
  if (!poll) {
    const err = new Error(`No poll named ${slug}.`);
    err.statusCode = 404;
    throw err;
  }
  await applyPollReset(poll);
  return { slug: poll.slug, id: poll.id, status: poll.status };
}

/**
 * Idempotent room polls for a known event. A second run leaves the row alone
 * so a host's later edits are not overwritten.
 */
async function ensureEventPoll({ slug, eventTitle, question, options, status }) {
  const { polls } = await loadAll();
  if (findPoll(polls, slug)) return { slug, created: false };
  const now = new Date().toISOString();
  const poll = {
    id: `poll-${slug}`,
    slug,
    eventId: "",
    eventTitle,
    question,
    options: options.map((label, index) => ({
      id: String(index + 1),
      label,
    })),
    status,
    createdByPersonId: "",
    createdByName: "Foresight",
    createdAt: now,
    updatedAt: now,
    closedAt: "",
    closesAt: "",
  };
  await persistPoll(poll);
  return { slug, created: true, status };
}

/**
 * Point an existing untouched draft at a best-project ballot.
 * Leaves the row alone once anyone has voted, or once it is live.
 */
async function refreshBestProjectDraft({ slug, question }) {
  const { polls, votes } = await loadAll();
  const poll = findPoll(polls, slug);
  if (!poll) return { slug, updated: false, reason: "missing" };
  if (poll.status !== "draft") return { slug, updated: false, reason: poll.status };
  const ballots = votes.filter((vote) => vote.pollId === poll.id);
  if (ballots.length) return { slug, updated: false, reason: "has-votes" };
  poll.question = normalizeQuestion(question);
  poll.options = [];
  poll.updatedAt = new Date().toISOString();
  await persistPoll(poll);
  return { slug, updated: true };
}

/**
 * Fill a poll with sample projects and open voting, so the vote page can be
 * looked at before the real slate exists. Reset from /polls clears it.
 */
async function installPreviewSlate({ slug, eventTitle, question, projects }) {
  const { polls } = await loadAll();
  const poll = findPoll(polls, slug);
  if (!poll) {
    const err = new Error(`No poll named ${slug}.`);
    err.statusCode = 404;
    throw err;
  }
  const now = new Date().toISOString();
  poll.eventTitle = eventTitle;
  poll.question = normalizeQuestion(question);
  poll.options = projects.map((project, index) => ({
    id: String(index + 1),
    label: String(project.label).trim(),
    people: String(project.people || "").trim(),
    url: project.url ? cleanUrl(project.url) : "",
  }));
  poll.status = "live";
  poll.closedAt = "";
  poll.updatedAt = now;
  await persistPoll(poll);
  return { slug, projects: poll.options.length, status: poll.status };
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
  ensureEventPoll,
  refreshBestProjectDraft,
  installPreviewSlate,
  resetPollBySlug,
};
