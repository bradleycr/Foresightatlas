/**
 * Standalone entry point for the Signal check-in bot.
 *
 * Usage:
 *   node server/signal/index.js          (uses .env.local / .env)
 *   SIGNAL_API_URL=... node server/signal/index.js
 *
 * Can also be required and started programmatically from the Express server.
 */

const path = require("path");

/* Load .env.local then .env (same strategy as the sync scripts) */
try { require("dotenv").config({ path: path.resolve(__dirname, "../../.env.local") }); } catch {}
try { require("dotenv").config({ path: path.resolve(__dirname, "../../.env") }); } catch {}

const { startPoller } = require("./poller");

/* ── Config validation ──────────────────────────────────────────────────── */

const REQUIRED_ENV = ["SIGNAL_API_URL", "SIGNAL_NUMBER", "SIGNAL_GROUP_ID", "SIGNAL_NODE_SLUG"];

function validateConfig() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[signal-bot] Missing required env vars: ${missing.join(", ")}`);
    console.error("[signal-bot] See .env.example for the full list.");
    process.exit(1);
  }

  const slug = process.env.SIGNAL_NODE_SLUG;
  if (!["berlin", "sf"].includes(slug)) {
    console.error(`[signal-bot] SIGNAL_NODE_SLUG must be "berlin" or "sf", got "${slug}"`);
    process.exit(1);
  }
}

/* ── Boot ────────────────────────────────────────────────────────────────── */

function boot() {
  validateConfig();

  const groupId = process.env.SIGNAL_GROUP_ID;
  const nodeSlug = process.env.SIGNAL_NODE_SLUG;
  const pollIntervalMs = parseInt(process.env.SIGNAL_POLL_INTERVAL_MS, 10) || 5_000;

  console.log(`[signal-bot] Starting poller for group=${groupId} node=${nodeSlug} interval=${pollIntervalMs}ms`);

  const poller = startPoller({ groupId, nodeSlug, pollIntervalMs });

  /* Graceful shutdown for Docker stop / SIGTERM */
  const shutdown = () => {
    console.log("[signal-bot] Shutting down…");
    poller.stop();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return poller;
}

/* Run directly or export for programmatic use */
if (require.main === module) {
  boot();
} else {
  module.exports = { boot, validateConfig };
}
