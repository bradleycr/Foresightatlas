"use strict";

/**
 * Pick where polls live. Postgres whenever it's configured; the local mock
 * file only for contributors running without one. There is no Sheet path —
 * a spreadsheet can't take a room of phones voting at once.
 */

const { hasDatabase } = require("../../db/postgres");
const { isLocalMockMode } = require("../../local-storage");

function pollStore() {
  if (process.env.FORESIGHT_FORCE_MOCK === "1") return require("./local");
  if (hasDatabase()) return require("./postgres");
  if (isLocalMockMode()) return require("./local");
  const err = new Error("Polls need the Atlas database. Set POSTGRES_URL (see docs/DATABASE.md).");
  err.statusCode = 503;
  throw err;
}

module.exports = { pollStore };
