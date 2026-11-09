#!/usr/bin/env node
/**
 * Apply db/migrations/*.sql in name order, once each.
 *
 *   pnpm db:migrate
 *
 * Each file runs in its own transaction and is recorded in schema_migrations,
 * so re-running is safe.
 */

"use strict";

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { withDirectClient } = require("../server/db/postgres");

const MIGRATIONS_DIR = path.resolve(__dirname, "../db/migrations");

async function main() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  await withDirectClient(async (client) => {
    await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    await client.query("alter table schema_migrations enable row level security");
    const { rows } = await client.query("select name from schema_migrations");
    const applied = new Set(rows.map((row) => row.name));

    for (const name of files) {
      if (applied.has(name)) {
        console.log(`  already applied  ${name}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [name]);
        await client.query("commit");
        console.log(`  applied          ${name}`);
      } catch (err) {
        await client.query("rollback");
        throw new Error(`${name}: ${err.message}`);
      }
    }
  });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
