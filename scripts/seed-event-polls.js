#!/usr/bin/env node
/**
 * Room polls for events that already have their own look on the vote page.
 * Safe to re-run: an existing slug is left alone, including later edits.
 * `--reset` clears a draft that nobody has voted on. It will not touch a live poll.
 *
 *   node scripts/seed-event-polls.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { ensureEventPoll, refreshBestProjectDraft } = require("../server/polls-store");

const POLLS = [
  {
    slug: "impact-lab",
    eventTitle: "Claude Impact Lab",
    question: "Vote for your favourite project",
    status: "draft",
    options: [],
  },
  {
    slug: "vision-weekend",
    eventTitle: "Vision Weekend USA",
    question: "Vote for your favourite project",
    status: "draft",
    options: [],
  },
];

async function main() {
  for (const poll of POLLS) {
    const result = await ensureEventPoll(poll);
    console.log(result.created ? `created ${result.slug}` : `already there ${result.slug}`);
    if (!process.argv.includes("--reset")) continue;
    const refreshed = await refreshBestProjectDraft({
      slug: poll.slug,
      question: "Vote for your favourite project",
    });
    console.log(refreshed.updated ? `reset ${poll.slug} to an open slate` : `left ${poll.slug} (${refreshed.reason})`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
