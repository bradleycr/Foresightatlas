#!/usr/bin/env node
/**
 * A room of phones voting at once, against a throwaway poll.
 *
 *   pnpm polls:load-test                                   # 300 phones → local API
 *   pnpm polls:load-test --phones 300 --base https://atlas.foresight.org
 *
 * Each phone opens the poll, votes, and some change their mind — including
 * phones that lost their localStorage (cookie only) or their cookie
 * (localStorage only). Projectors poll throughout. The test passes only if
 * the count equals the number of phones, exactly. The poll is deleted after.
 */

"use strict";

const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { withDirectClient } = require("../server/db/postgres");

/* Setup and checks use the direct connection, so the test never competes with the API for pooler slots. */
let db = null;
const query = (text, params) => db.query(text, params);

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : fallback;
}

const PHONES = Number(arg("phones", 300));
const PROJECTORS = Number(arg("projectors", 10));
const BASE = String(arg("base", "http://localhost:3001")).replace(/\/$/, "");
const SLUG = `loadtest-${crypto.randomBytes(3).toString("hex")}`;
const OPTION_COUNT = 13;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const timings = { get: [], vote: [] };
const failures = [];

async function timed(kind, fn) {
  const started = performance.now();
  try {
    return await fn();
  } finally {
    timings[kind].push(performance.now() - started);
  }
}

/** One phone: its own localStorage key and cookie jar. */
function makePhone(index) {
  const ids = Array.from({ length: OPTION_COUNT }, (_, i) => String(i + 1));
  const guest = index % 4 === 0;
  return {
    storageKey: crypto.randomUUID(),
    cookie: "",
    team: guest ? "__guest__" : pick(ids),
    ids,
  };
}

function ballotFor(phone) {
  const pool = shuffle(phone.ids.filter((id) => id !== phone.team));
  return { optionId: pool[0], secondOptionId: pool[1], thirdOptionId: pool[2] };
}

async function request(phone, method, url, body, { sendKey = true, sendCookie = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (sendCookie && phone.cookie) headers.Cookie = phone.cookie;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify({ ...body, voterKey: sendKey ? phone.storageKey : undefined }) : undefined,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) phone.cookie = setCookie.split(";")[0];
    const payload = await res.json().catch(() => ({}));
    if (res.status === 503 || res.status === 429) {
      await sleep(400 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${payload.error || ""}`);
    if (payload.voterKey && sendKey) phone.storageKey = payload.voterKey;
    return payload;
  }
  throw new Error("still busy after 3 tries");
}

async function runPhone(phone, index) {
  try {
    await sleep(Math.random() * 1500);
    await timed("get", () =>
      request(phone, "GET", `${BASE}/api/polls?slug=${SLUG}&voterKey=${phone.storageKey}`),
    );
    await timed("vote", () =>
      request(phone, "POST", `${BASE}/api/polls`, { action: "vote", slug: SLUG, teamOptionId: phone.team, ...ballotFor(phone) }),
    );
    /* A third change their mind; some of those lost one copy of their id. */
    if (index % 3 === 0) {
      const mode = index % 9;
      /* Storage wiped and a fresh id minted, cookie intact. */
      if (mode === 6) phone.storageKey = crypto.randomUUID();
      const opts =
        mode === 0
          ? { sendKey: false }
          : mode === 3
            ? { sendCookie: false }
            : {};
      await timed("vote", () =>
        request(phone, "POST", `${BASE}/api/polls`, { action: "vote", slug: SLUG, teamOptionId: phone.team, ...ballotFor(phone) }, opts),
      );
    }
  } catch (err) {
    failures.push(`phone ${index}: ${err.message}`);
  }
}

async function runProjector(stopAt, seen) {
  const viewer = makePhone(-1);
  while (Date.now() < stopAt) {
    try {
      const { poll } = await timed("get", () =>
        request(viewer, "GET", `${BASE}/api/polls?slug=${SLUG}&voterKey=${viewer.storageKey}`),
      );
      seen.push(poll.totalVotes);
    } catch (err) {
      failures.push(`projector: ${err.message}`);
    }
    await sleep(500);
  }
}

const percentile = (list, p) => {
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
};

async function main() {
  await withDirectClient(async (client) => {
    db = client;
    await run();
  });
}

async function run() {
  const options = Array.from({ length: OPTION_COUNT }, (_, i) => ({
    id: String(i + 1),
    label: `Load test project ${i + 1}`,
    people: "A, B",
    url: "",
  }));
  await query(
    `insert into polls (id, slug, event_title, question, options, status)
     values ($1, $2, 'Load test', 'Load test', $3::jsonb, 'live')`,
    [`poll-${SLUG}`, SLUG, JSON.stringify(options)],
  );
  console.log(`Poll ${SLUG}: ${PHONES} phones, ${PROJECTORS} projectors → ${BASE}`);

  try {
    const phones = Array.from({ length: PHONES }, (_, i) => makePhone(i));
    const seen = [];
    const started = Date.now();
    const projectors = Array.from({ length: PROJECTORS }, () => runProjector(started + 8000, seen));
    await Promise.all([...phones.map(runPhone), ...projectors]);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    await sleep(1600);
    const { poll } = await request(makePhone(-1), "GET", `${BASE}/api/polls?slug=${SLUG}&voterKey=check-${Date.now()}`);
    const { rows } = await query(
      `select count(*)::int as ballots, coalesce(sum(revisions), 0)::int as submissions
         from poll_ballots where poll_id = $1`,
      [`poll-${SLUG}`],
    );
    const counted = rows[0];
    const expected = PHONES - failures.filter((f) => f.startsWith("phone")).length;

    console.log(`\nFinished in ${seconds}s`);
    console.log(`  submissions sent        ${counted.submissions}`);
    console.log(`  ballots in database     ${counted.ballots}   (expected ${expected})`);
    console.log(`  count on the projector  ${poll.totalVotes}`);
    console.log(`  GET   p50 ${percentile(timings.get, 50)}ms  p95 ${percentile(timings.get, 95)}ms  (${timings.get.length})`);
    console.log(`  VOTE  p50 ${percentile(timings.vote, 50)}ms  p95 ${percentile(timings.vote, 95)}ms  (${timings.vote.length})`);
    const backwards = seen.some((count, i) => i > 0 && count < seen[i - 1]);
    console.log(`  projector reads         ${seen.length}${backwards ? "  (count stepped back)" : ""}`);
    console.log(`  failures                ${failures.length}`);
    failures.slice(0, 8).forEach((f) => console.log(`    ${f}`));

    const ok = counted.ballots === expected && poll.totalVotes === expected && failures.length === 0;
    console.log(ok ? "\nPASS — one ballot per phone, nothing lost." : "\nFAIL");
    process.exitCode = ok ? 0 : 1;
  } finally {
    await query("delete from poll_ballots where poll_id = $1", [`poll-${SLUG}`]);
    await query("delete from polls where id = $1", [`poll-${SLUG}`]);
    console.log(`Removed ${SLUG}.`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
