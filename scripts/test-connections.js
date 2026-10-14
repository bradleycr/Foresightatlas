#!/usr/bin/env node
/**
 * Smoke-test private account-scoped connections (mock API).
 *
 *   FORESIGHT_FORCE_MOCK=1 node scripts/test-connections.js
 */

process.env.FORESIGHT_FORCE_MOCK = "1";
process.env.DIRECTORY_SESSION_SECRET =
  process.env.DIRECTORY_SESSION_SECRET || "test-connections-secret";
// Dummy id so realdata-store can load as a module; mock mode forced above.
process.env.SPREADSHEET_ID = process.env.SPREADSHEET_ID || "mock-test-sheet";
delete process.env.GOOGLE_SHEETS_API_KEY;
delete process.env.GOOGLE_API_KEY;
delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

const http = require("http");
const { issueDirectorySession } = require("../server/directory-auth");
const { getLocalDatabase } = require("../server/local-storage");

async function startMockServer() {
  const app = require("../server/index.mock");
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
    server.on("error", reject);
  });
}

async function req(base, method, path, { token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  const { getLocalDatabase, DATABASE_FILE } = require("../server/local-storage");
  const fsp = require("fs").promises;
  const db = await getLocalDatabase();
  // Isolate from prior local runs that left bookmark rows in mock/*.local.json.
  db.connections = [];
  db.meta = { ...(db.meta || {}), updatedAt: new Date().toISOString() };
  await fsp.writeFile(DATABASE_FILE, `${JSON.stringify(db, null, 2)}\n`);

  const alice = db.people.find((p) => p.id === "mock-person-alice");
  const bob = db.people.find((p) => p.id === "mock-person-bob");
  if (!alice || !bob) throw new Error("mock people missing");

  const aliceSession = issueDirectorySession({
    person: alice,
    auth: { mustChangePassword: false },
  });
  const bobSession = issueDirectorySession({
    person: bob,
    auth: { mustChangePassword: false },
  });

  const { server, base } = await startMockServer();
  try {
    console.log("1) Unauthenticated GET → 401 …");
    const unauth = await req(base, "GET", "/api/connections");
    if (unauth.status !== 401) {
      throw new Error(`expected 401, got ${unauth.status}`);
    }
    console.log("   ok");

    console.log("2) Alice bookmarks Bob …");
    const add = await req(base, "POST", "/api/connections", {
      token: aliceSession.token,
      body: { action: "add", targetPersonId: bob.id },
    });
    if (add.status !== 200 || !add.json.targetPersonIds?.includes(bob.id)) {
      throw new Error(`add failed: ${JSON.stringify(add)}`);
    }
    console.log("   ok —", add.json.targetPersonIds);

    console.log("3) Alice GET sees Bob; Bob GET does not see Alice's list …");
    const aliceGet = await req(base, "GET", "/api/connections", {
      token: aliceSession.token,
    });
    const bobGet = await req(base, "GET", "/api/connections", {
      token: bobSession.token,
    });
    if (!aliceGet.json.targetPersonIds?.includes(bob.id)) {
      throw new Error("Alice missing Bob after add");
    }
    if ((bobGet.json.targetPersonIds || []).includes(alice.id)) {
      throw new Error("Bob leaked Alice's bookmark graph");
    }
    if ((bobGet.json.targetPersonIds || []).includes(bob.id)) {
      throw new Error("Bob incorrectly sees himself as Alice's target");
    }
    console.log("   ok — Alice:", aliceGet.json.targetPersonIds, "Bob:", bobGet.json.targetPersonIds);

    console.log("4) Client cannot spoof another owner via body …");
    const spoof = await req(base, "POST", "/api/connections", {
      token: bobSession.token,
      body: {
        action: "add",
        targetPersonId: alice.id,
        ownerPersonId: alice.id, // ignored — session wins
      },
    });
    if (spoof.status !== 200 || !spoof.json.targetPersonIds?.includes(alice.id)) {
      throw new Error(`bob add alice failed: ${JSON.stringify(spoof)}`);
    }
    const aliceAfterSpoof = await req(base, "GET", "/api/connections", {
      token: aliceSession.token,
    });
    // Alice's list should still be just Bob — Bob adding himself as "alice"
    // must not rewrite Alice's rows.
    if (
      aliceAfterSpoof.json.targetPersonIds?.length !== 1 ||
      !aliceAfterSpoof.json.targetPersonIds.includes(bob.id)
    ) {
      throw new Error(
        `Alice list corrupted by spoof attempt: ${JSON.stringify(aliceAfterSpoof.json)}`,
      );
    }
    console.log("   ok — Alice still only has Bob");

    console.log("5) Alice removes Bob …");
    const remove = await req(base, "POST", "/api/connections", {
      token: aliceSession.token,
      body: { action: "remove", targetPersonId: bob.id },
    });
    if (remove.status !== 200 || remove.json.targetPersonIds?.includes(bob.id)) {
      throw new Error(`remove failed: ${JSON.stringify(remove)}`);
    }
    console.log("   ok");

    console.log("\n✓ connections privacy + persistence smoke test passed.");
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
