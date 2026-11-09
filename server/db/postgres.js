"use strict";

/**
 * Postgres for Atlas (Supabase, provisioned through the Vercel Marketplace).
 *
 * Serverless fans out into many small instances. Each one keeps a tiny pool
 * and talks to Supabase's pooler (POSTGRES_URL, transaction mode), which
 * multiplexes them onto a handful of real connections. That is what lets a
 * room of 300 phones hit the API at once without exhausting the database.
 */

const { Pool } = require("pg");

let pool = null;

function hasDatabase() {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

/**
 * node-postgres reads `sslmode=require` as "verify the full chain", which
 * Supabase's pooler certificate does not satisfy. TLS stays on; we set it
 * explicitly instead of through the URL.
 */
function cleanConnectionString(raw) {
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("supa");
  return url.toString();
}

function connectionConfig({ direct = false } = {}) {
  const raw = direct
    ? process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL
    : process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("POSTGRES_URL is not set. Polls need the Atlas database.");
  }
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(raw);
  return {
    connectionString: cleanConnectionString(raw),
    ssl: local ? false : { rejectUnauthorized: false },
  };
}

function getPool() {
  if (pool) return pool;
  pool = new Pool({
    ...connectionConfig(),
    max: 6,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });
  /* An idle socket dropped by the pooler must not crash the function. */
  pool.on("error", (err) => {
    console.error("postgres: idle client error:", err.message);
  });
  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

/** A dedicated session for migrations, which need real transactions. */
async function withDirectClient(fn) {
  const { Client } = require("pg");
  const client = new Client(connectionConfig({ direct: true }));
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function closePool() {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}

module.exports = { hasDatabase, query, withDirectClient, closePool };
