"use strict";

/**
 * Pick where polls live:
 *
 *   1. Supabase over HTTP — production. No connection held per instance, so
 *      a burst of phones can't exhaust the database pooler.
 *   2. Postgres over a socket — self-hosting with plain Postgres.
 *   3. The local mock file — contributors without a database.
 *
 * There is no Sheet path: a spreadsheet can't take a room voting at once.
 */

const { hasRestApi } = require("../../db/supabase-rest");
const { hasDatabase } = require("../../db/postgres");

/* Each store is required only when chosen: the mock store drags in the Sheets client. */
function pollStore() {
  if (process.env.FORESIGHT_FORCE_MOCK === "1") return require("./local");
  if (hasRestApi()) return require("./supabase");
  if (hasDatabase()) return require("./postgres");
  if (require("../../local-storage").isLocalMockMode()) return require("./local");
  const err = new Error("Polls need the Atlas database. Set SUPABASE_URL or POSTGRES_URL (see docs/DATABASE.md).");
  err.statusCode = 503;
  throw err;
}

module.exports = { pollStore };
