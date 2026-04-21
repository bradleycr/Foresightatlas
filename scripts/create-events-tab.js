#!/usr/bin/env node
/**
 * Create the Events tab in the Foresight Map Google Sheet and populate it
 * with headers + seed events (Berlin specials, Vision Weekends, workshops).
 *
 * Requires write access: GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS.
 * Share the spreadsheet with the service account email as Editor.
 *
 *   node scripts/create-events-tab.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs").promises;
const path = require("path");
const { google } = require("googleapis");
const { SHEET_NAMES, EVENTS_HEADERS } = require("./sheet-schema.js");

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ";

/** Seed events: same as in src/data/events.ts (Berlin specials + Vision Weekends + workshops). */
const SEED_EVENTS = [
  {
    id: "berlin-open-house-2026-03-01",
    nodeSlug: "berlin",
    title: "Open House",
    description:
      "Come visit the Berlin Node space. Meet the team, see the facilities, and learn about upcoming programming and residency opportunities.",
    location: "Berlin Node",
    startAt: "2026-03-01T14:00:00+01:00",
    endAt: "2026-03-01T18:00:00+01:00",
    type: "open-house",
    tags: ["open-house", "community"],
    visibility: "public",
    capacity: 50,
    externalLink: "https://luma.com/foresightinstitute",
    recurrenceGroupId: null,
    lumaEventId: "",
  },
  {
    id: "berlin-open-house-2026-03-19",
    nodeSlug: "berlin",
    title: "Open House",
    description:
      "Second open house at the Berlin Node — an afternoon of tours, conversations, and introductions to the Foresight community in Europe.",
    location: "Berlin Node",
    startAt: "2026-03-19T14:00:00+01:00",
    endAt: "2026-03-19T18:00:00+01:00",
    type: "open-house",
    tags: ["open-house", "community"],
    visibility: "public",
    capacity: 50,
    externalLink: "",
    recurrenceGroupId: null,
    lumaEventId: "",
  },
  {
    id: "berlin-node-launch-2026-04-01",
    nodeSlug: "berlin",
    title: "Berlin Node Launch Event",
    description:
      "The official launch of the Foresight Berlin Node. Join us to celebrate the opening with keynotes, demos, and the first community gathering at our new European hub.",
    location: "Berlin Node",
    startAt: "2026-04-01T17:00:00+02:00",
    endAt: "2026-04-01T22:00:00+02:00",
    type: "launch",
    tags: ["launch", "flagship", "celebration"],
    visibility: "public",
    capacity: 100,
    externalLink: "",
    recurrenceGroupId: null,
    lumaEventId: "",
  },
  {
    id: "berlin-secure-sovereign-ai-2026-07-18",
    nodeSlug: "berlin",
    title: "Secure & Sovereign AI Workshop",
    description:
      "A Foresight flagship workshop at the Berlin Node on making AI an engine of defense in a multipolar human–AI world. ~80 researchers, engineers, cryptographers, security practitioners and funders work across three tracks — AI for Secure AI (self-improving defenses, formal proofs, red-teaming), AI for Private AI (confidential compute, encrypted data pipelines, distributed trust), and AI for Decentralized & Cooperative AI (multi-agent coordination, mechanism design, game theory). Short talks, unconference-style working groups, mentorship hours and sponsor gatherings; projects incubated here are eligible for Foresight grants, and residents may stay on to keep sprinting at the Berlin Node. Held under Chatham House Rule. Full details and application: https://foresight.org/events/2026-secure-sovereign-ai-workshop/",
    location: "Berlin, Germany",
    startAt: "2026-07-18T09:00:00+02:00",
    endAt: "2026-07-19T18:00:00+02:00",
    type: "workshop",
    tags: ["workshop", "ai", "secure-ai", "privacy", "decentralized", "flagship"],
    visibility: "public",
    capacity: 80,
    externalLink: "https://foresight.org/events/2026-secure-sovereign-ai-workshop/",
    recurrenceGroupId: null,
    lumaEventId: "",
  },
  {
    id: "vision-weekend-puerto-rico-2026-02-06",
    nodeSlug: "global",
    title: "Vision Weekend — Puerto Rico",
    description:
      "Foresight Vision Weekend in San Juan. Connect with grantees, fellows, and the event team for a focused gathering on long-term vision and collaboration.",
    location: "San Juan",
    startAt: "2026-02-06T09:00:00-04:00",
    endAt: "2026-02-08T18:00:00-04:00",
    type: "vision-weekend",
    tags: ["vision-weekend", "flagship", "grantees", "fellows"],
    visibility: "internal",
    capacity: null,
    externalLink: "",
    recurrenceGroupId: null,
    lumaEventId: "",
  },
  {
    id: "vision-weekend-uk-2026-06-05",
    nodeSlug: "global",
    title: "Vision Weekend — UK",
    description:
      "Foresight Vision Weekend in London. Brings together grantees, fellows, and the event team for vision-setting and community building in Europe.",
    location: "London",
    startAt: "2026-06-05T09:00:00+01:00",
    endAt: "2026-06-07T18:00:00+01:00",
    type: "vision-weekend",
    tags: ["vision-weekend", "flagship", "grantees", "fellows"],
    visibility: "internal",
    capacity: null,
    externalLink: "",
    recurrenceGroupId: null,
    lumaEventId: "",
  },
  {
    id: "vision-weekend-us-sf-2026-12-04",
    nodeSlug: "global",
    title: "Vision Weekend — US (SF)",
    description:
      "Foresight Vision Weekend in San Francisco. Grantees, fellows, and SF node community gather for the flagship US vision weekend.",
    location: "SF",
    startAt: "2026-12-04T09:00:00-08:00",
    endAt: "2026-12-06T18:00:00-08:00",
    type: "vision-weekend",
    tags: ["vision-weekend", "flagship", "grantees", "fellows", "node-sf"],
    visibility: "internal",
    capacity: null,
    externalLink: "",
    recurrenceGroupId: null,
    lumaEventId: "",
  },
  {
    id: "workshop-existential-hope-korea-2026-07-07",
    nodeSlug: "global",
    title: "Workshop: Existential Hope (Korea)",
    description:
      "Workshop on existential hope and long-term futures, held in South Korea. Cross-regional gathering for fellows and collaborators.",
    location: "South Korea",
    startAt: "2026-07-07T09:00:00+09:00",
    endAt: "2026-07-09T18:00:00+09:00",
    type: "workshop",
    tags: ["workshop", "existential-hope", "korea"],
    visibility: "internal",
    capacity: null,
    externalLink: "",
    recurrenceGroupId: null,
    lumaEventId: "",
  },
  {
    id: "workshop-ai-for-science-sf-2026-09-25",
    nodeSlug: "sf",
    title: "Workshop: AI for Science (SF)",
    description:
      "SF workshop on AI for science: frontier research and applications. Grantees, fellows, and both nodes invited. Team days aligned.",
    location: "SF",
    startAt: "2026-09-25T09:00:00-07:00",
    endAt: "2026-09-27T18:00:00-07:00",
    type: "workshop",
    tags: ["workshop", "ai", "science", "node-sf", "node-berlin", "team-days"],
    visibility: "internal",
    capacity: null,
    externalLink: "",
    recurrenceGroupId: null,
    lumaEventId: "",
  },
];

function eventToRow(e) {
  return [
    e.id ?? "",
    e.nodeSlug ?? "berlin",
    e.title ?? "",
    e.description ?? "",
    e.location ?? "",
    e.startAt ?? "",
    e.endAt ?? "",
    e.type ?? "other",
    Array.isArray(e.tags) ? JSON.stringify(e.tags) : (e.tags ?? "[]"),
    e.visibility ?? "internal",
    e.capacity != null ? String(e.capacity) : "",
    e.externalLink ?? "",
    e.recurrenceGroupId ?? "",
    e.lumaEventId ?? "",
  ];
}

async function ensureEventsSheet(sheets) {
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const existing = (data.sheets || []).map((s) => s.properties.title);
  if (existing.includes(SHEET_NAMES.EVENTS)) {
    console.log("Events tab already exists.");
    return;
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: SHEET_NAMES.EVENTS } } }],
    },
  });
  console.log("Created tab: Events");
}

async function writeEventsSheet(sheets) {
  const rows = [EVENTS_HEADERS, ...SEED_EVENTS.map(eventToRow)];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAMES.EVENTS}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
  console.log(`Wrote ${rows.length} rows (1 header + ${SEED_EVENTS.length} events) to Events.`);
}

async function main() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  let key;
  if (keyJson) {
    try {
      key = typeof keyJson === "string" ? JSON.parse(keyJson) : keyJson;
    } catch (err) {
      console.error("GOOGLE_SERVICE_ACCOUNT_KEY is invalid JSON:", err.message);
      process.exit(1);
    }
  } else if (keyPath) {
    const resolved = path.resolve(keyPath);
    try {
      key = JSON.parse(await fs.readFile(resolved, "utf8"));
    } catch (err) {
      console.error("Could not read service account key from", resolved, err.message);
      process.exit(1);
    }
  } else {
    console.error(
      "Set GOOGLE_SERVICE_ACCOUNT_KEY (JSON string) or GOOGLE_APPLICATION_CREDENTIALS (path to key file).\n" +
        "Share the spreadsheet with the service account email as Editor."
    );
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  await ensureEventsSheet(sheets);
  await writeEventsSheet(sheets);

  console.log(`Done. Sheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
