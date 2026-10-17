#!/usr/bin/env node
/**
 * Local smoke test for /api/member-access-request (no Resend required).
 *
 *   AUTH_REVEAL_LINKS=true node scripts/test-access-request.js
 *
 * Forces mock mode so we don't need sheet credentials.
 */

process.env.AUTH_REVEAL_LINKS = process.env.AUTH_REVEAL_LINKS || "true";
process.env.CLAIM_BASE_URL =
  process.env.CLAIM_BASE_URL || "http://localhost:3000";
process.env.DIRECTORY_SESSION_SECRET =
  process.env.DIRECTORY_SESSION_SECRET || "test-access-request-secret";
process.env.FORESIGHT_FORCE_MOCK = "1";
// Dummy id so realdata-store can load as a module; mock mode forced above.
process.env.SPREADSHEET_ID = process.env.SPREADSHEET_ID || "mock-test-sheet";
delete process.env.GOOGLE_SHEETS_API_KEY;
delete process.env.GOOGLE_API_KEY;
delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

const fs = require("fs");
const path = require("path");
const { requestAccessLink } = require("../server/access-request");
const { isLocalMockMode, getLocalDatabase } = require("../server/local-storage");

async function ensureMockEmails() {
  const db = await getLocalDatabase();
  let dirty = false;
  for (const person of db.people || []) {
    if (person.id === "mock-person-alice" && !person.email) {
      person.email = "alice@example.com";
      dirty = true;
    }
    if (person.id === "mock-person-bob" && !person.email) {
      person.email = "bob@example.com";
      dirty = true;
    }
  }
  if (dirty) {
    const file = path.join(__dirname, "../mock/database.local.json");
    fs.writeFileSync(file, `${JSON.stringify(db, null, 2)}\n`);
  }
}

async function main() {
  if (!isLocalMockMode()) {
    console.error("Expected mock mode for this smoke test.");
    process.exit(1);
  }
  await ensureMockEmails();

  const fakeReq = {
    headers: { host: "localhost:3001", "x-forwarded-proto": "http" },
    socket: { remoteAddress: "127.0.0.1" },
  };

  console.log("0) Self-serve links stay paused …");
  try {
    await requestAccessLink(fakeReq, {
      firstName: "Alice",
      lastName: "Example",
      email: "alice@example.com",
    });
    throw new Error("expected self-serve links to be paused");
  } catch (e) {
    if (e.statusCode !== 410) throw e;
    console.log("   ok —", e.message);
    return;
  }

  console.log("1) Match Alice Example / alice@example.com …");
  const hit = await requestAccessLink(fakeReq, {
    firstName: "Alice",
    lastName: "Example",
    email: "alice@example.com",
  });
  if (!hit.ok) throw new Error("expected ok");
  if (!hit.claim_link) {
    throw new Error("expected claim_link with AUTH_REVEAL_LINKS (got " + JSON.stringify(hit) + ")");
  }
  if (!hit.claim_link.includes("/claim?token=")) {
    throw new Error("bad claim_link shape: " + hit.claim_link);
  }
  console.log("   ok —", hit.kind || "claim", hit.claim_link.slice(0, 64) + "…");

  console.log("2) Miss (wrong email) — ok, no link …");
  const miss = await requestAccessLink(fakeReq, {
    firstName: "Alice",
    lastName: "Example",
    email: "nobody@example.com",
  });
  if (!miss.ok) throw new Error("miss should still be ok");
  if (miss.claim_link) throw new Error("miss must not reveal a link");
  if (!/couldn.t verify/i.test(miss.message || "")) {
    throw new Error("expected verify-failure message, got: " + miss.message);
  }
  console.log("   ok — no claim_link leaked");

  console.log("3) Validation error on empty name …");
  try {
    await requestAccessLink(fakeReq, { email: "a@b.co" });
    throw new Error("should have thrown");
  } catch (e) {
    if (e.statusCode !== 400) throw e;
    console.log("   ok —", e.message);
  }

  console.log("\n✓ access-request smoke test passed (on-screen links, no mail).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
