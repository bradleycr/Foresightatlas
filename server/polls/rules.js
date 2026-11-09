"use strict";

/**
 * The shape of a poll: limits, statuses, and how a slate of projects is
 * cleaned. Pure functions — no storage, no requests.
 */

const crypto = require("crypto");

const STATUSES = new Set(["draft", "live", "closed"]);
const SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const MAX_OPTIONS = 48;
const MIN_LIVE_OPTIONS = 4;
const MAX_QUESTION = 200;
const MAX_OPTION = 120;
const MAX_PEOPLE = 160;
const MAX_URL = 400;
const FINAL_MINUTE_MS = 60 * 1000;
/** Team value for a phone that was not on a project. No lockout. */
const GUEST_TEAM = "__guest__";

function randomSlug(length = 6) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return out;
}

function optionIdFromIndex(index) {
  return String(index + 1);
}

function normalizeQuestion(value) {
  const question = String(value || "").trim();
  if (!question) throw new Error("A question is required.");
  if (question.length > MAX_QUESTION) {
    throw new Error(`Keep the question under ${MAX_QUESTION} characters.`);
  }
  return question;
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
 * A GitHub repo only. Accepts github.com/org/project, org/project, an SSH
 * remote, or a deep link — all trimmed to the repo root.
 */
function cleanGithubRepo(raw) {
  let value = String(raw || "")
    .trim()
    .replace(/^[\s"'`“”‘’<]+|[\s"'`“”‘’>]+$/g, "")
    .replace(/\s+/g, "")
    .replace(/^@/, "");
  if (!value) throw new Error("Add the GitHub repo.");

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
  if (url.hostname.replace(/^www\./, "").toLowerCase() !== "github.com") {
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
  if (url.href.length > MAX_URL) throw new Error("That link is too long.");
  return url.href;
}

function assertLabel(label) {
  if (label.length < 2) throw new Error("Project name needs at least 2 characters.");
  if (label.length > MAX_OPTION) {
    throw new Error(`Each project name must be ${MAX_OPTION} characters or fewer.`);
  }
}

function sameLabel(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function projectFromInput(item, previous = []) {
  const label = typeof item === "string" ? item.trim() : String(item?.label || "").trim();
  if (!label) return null;
  assertLabel(label);
  const prev = previous.find((option) => sameLabel(option.label, label));
  const isObject = item && typeof item === "object";
  const people =
    isObject && item.people != null ? cleanPeople(item.people) : cleanPeople(prev?.people || "");
  const url = isObject && item.url != null ? cleanUrl(item.url) : String(prev?.url || "");
  return { label, people, url };
}

/** Full slate replace — draft only, so renumbering cannot orphan a ballot. */
function normalizeOptions(input, previous = []) {
  const options = [];
  const seen = new Set();
  for (const item of Array.isArray(input) ? input : []) {
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
 * Append one project without renumbering existing ids — ballots already
 * point at those ids.
 */
function appendProject(existing, project) {
  const label = String(project?.label || "").trim();
  const people = cleanPeople(project?.people);
  const url = cleanUrl(project?.url);
  assertLabel(label);
  const options = Array.isArray(existing) ? [...existing] : [];
  if (options.length >= MAX_OPTIONS) {
    throw new Error(`Keep it to ${MAX_OPTIONS} projects or fewer.`);
  }
  if (options.some((option) => sameLabel(option.label, label))) {
    throw new Error("That project is already on this poll.");
  }
  const maxId = options.reduce((max, option) => {
    const n = Number.parseInt(String(option.id), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  options.push({ id: String(maxId + 1), label, people, url });
  return options;
}

module.exports = {
  STATUSES,
  MAX_OPTIONS,
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
};
