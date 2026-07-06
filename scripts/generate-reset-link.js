#!/usr/bin/env node
/**
 * Mint a password-reset magic link for one member who forgot their password.
 *
 * The link opens the same /claim page in "reset" mode: the member picks a new
 * password and is signed back in. Links are signed (HMAC), expire after 24h,
 * and are one-time-use — they're bound to a fingerprint of the CURRENT
 * password hash, so the moment the password changes the link is dead.
 *
 * There is intentionally no self-serve reset endpoint (no email infra, and an
 * unauthenticated "send me a reset" API would invite account-takeover
 * attempts). An admin runs this and sends the link out-of-band.
 *
 * Usage:
 *   pnpm reset:link -- "Full Name"
 *   node scripts/generate-reset-link.js "Bradley Clark Royes" [--base <url>] [--hours <n>]
 *
 * Env (from .env.local / .env):
 *   DIRECTORY_SESSION_SECRET (or SESSION_SECRET) — MUST match the deployed server.
 *   CLAIM_BASE_URL — default site origin for the link (overridable with --base).
 *   Sheet credentials — to look up the person's row.
 */

// quiet: dotenv's banner goes to stdout and would corrupt piped output.
require("dotenv").config({ path: ".env.local", quiet: true });
require("dotenv").config({ quiet: true });

const { loadRealDataRecords } = require("../server/realdata-store");
const { issuePasswordResetToken } = require("../server/directory-auth");

function parseArgs(argv) {
  const args = { name: "", base: process.env.CLAIM_BASE_URL || "", hours: 24 };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base") {
      args.base = argv[i + 1] || "";
      i += 1;
    } else if (arg === "--hours") {
      args.hours = Number(argv[i + 1]) || 24;
      i += 1;
    } else if (!arg.startsWith("--")) {
      args.name = args.name ? `${args.name} ${arg}` : arg;
    }
  }
  return args;
}

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

async function main() {
  const args = parseArgs(process.argv);
  if (!args.name) {
    console.error('Usage: pnpm reset:link -- "Full Name" [--base <url>] [--hours <n>]');
    process.exit(1);
  }
  if (!process.env.DIRECTORY_SESSION_SECRET && !process.env.SESSION_SECRET) {
    console.error(
      "⚠  No DIRECTORY_SESSION_SECRET/SESSION_SECRET set — using the dev fallback secret.\n" +
        "   The link will only validate against a server using the same secret.\n",
    );
  }

  const { records } = await loadRealDataRecords();
  const target = norm(args.name);
  const matches = records.filter((r) => norm(r.person.fullName) === target);

  if (matches.length === 0) {
    console.error(`No profile found named "${args.name}".`);
    const partial = records
      .filter((r) => norm(r.person.fullName).includes(target.split(" ")[0]))
      .slice(0, 8)
      .map((r) => `  • ${r.person.fullName}`);
    if (partial.length > 0) {
      console.error(`Did you mean:\n${partial.join("\n")}`);
    }
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(
      `Multiple rows named "${args.name}" — clean up duplicates first:\n` +
        matches.map((r) => `  • row ${r.rowNumber}`).join("\n"),
    );
    process.exit(1);
  }

  const record = matches[0];
  if (!record.auth.passwordHash) {
    console.error(
      `${record.person.fullName} has never set a password — send their CLAIM link instead:\n` +
        `  pnpm claim:links -- --unclaimed-only | grep "${record.person.fullName}"`,
    );
    process.exit(1);
  }

  const token = issuePasswordResetToken(
    record.person.id,
    record.auth.passwordHash,
    args.hours * 60 * 60 * 1000,
  );
  const base = String(args.base || "").replace(/\/+$/, "");
  const url = `${base}/claim?token=${encodeURIComponent(token)}`;

  console.error(
    `✓ Reset link for ${record.person.fullName} (valid ${args.hours}h, one-time use):\n`,
  );
  console.log(url);
}

main().catch((error) => {
  console.error("Failed to generate reset link:", error?.message || error);
  process.exit(1);
});
