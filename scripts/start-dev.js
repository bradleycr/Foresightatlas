#!/usr/bin/env node
"use strict";

/**
 * Start dev with a single command: find a free port for the API, then run
 * both the API and Vite with the proxy pointing at that port. Avoids
 * EADDRINUSE when 3000/3001 are already in use.
 */

const net = require("net");
const { spawn } = require("child_process");
const path = require("path");

const API_PORT_MIN = 3001;
const API_PORT_MAX = 3010;

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findFreePort() {
  for (let p = API_PORT_MIN; p <= API_PORT_MAX; p++) {
    if (await isPortFree(p)) return p;
  }
  throw new Error(
    `No free port in range ${API_PORT_MIN}–${API_PORT_MAX}. Stop other processes using those ports.`,
  );
}

async function main() {
  const apiPort = await findFreePort();
  const apiTarget = `http://localhost:${apiPort}`;
  const root = path.resolve(__dirname, "..");
  const env = {
    ...process.env,
    PORT: String(apiPort),
    VITE_API_PROXY_TARGET: apiTarget,
  };

  console.log(`[start-dev] API will use port ${apiPort}; Vite proxy → ${apiTarget}\n`);

  const api = spawn("node", ["server/index.js"], {
    cwd: root,
    env: { ...env },
    stdio: "inherit",
  });
  const vite = spawn("pnpm", ["exec", "vite"], {
    cwd: root,
    env: { ...env },
    stdio: "inherit",
  });

  api.on("error", (err) => {
    console.error("[start-dev] API failed:", err.message);
    vite.kill();
    process.exit(1);
  });
  vite.on("error", (err) => {
    console.error("[start-dev] Vite failed:", err.message);
    api.kill();
    process.exit(1);
  });
  api.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      vite.kill();
      process.exit(code);
    }
  });
  vite.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      api.kill();
      process.exit(code);
    }
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
