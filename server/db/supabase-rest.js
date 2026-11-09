"use strict";

/**
 * Supabase's HTTP API (PostgREST), server-side only.
 *
 * Why HTTP and not a Postgres socket: serverless spins up as many instances
 * as a burst needs, and every socket counts against the pooler's client cap.
 * Over HTTP an instance holds nothing between requests; Supabase keeps the
 * database connections on its side, behind its own small pool.
 */

const TIMEOUT_MS = 8000;

function serverKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

function hasRestApi() {
  return Boolean(process.env.SUPABASE_URL && serverKey());
}

function headers(extra = {}) {
  const key = serverKey();
  const out = { apikey: key, "Content-Type": "application/json", ...extra };
  /* Legacy service-role keys are JWTs and go in Authorization too; new sb_secret keys don't. */
  if (key.split(".").length === 3) out.Authorization = `Bearer ${key}`;
  return out;
}

function restError(status, body) {
  const err = new Error(body?.message || `Supabase responded ${status}.`);
  err.code = body?.code || "";
  err.statusCode = status === 409 ? 409 : undefined;
  err.transient = status === 408 || status === 429 || status >= 500;
  return err;
}

/**
 * @param {string} path  relative to /rest/v1, e.g. "polls?select=*"
 * @param {{ method?: string, body?: unknown, prefer?: string }} [opts]
 */
async function rest(path, { method = "GET", body, prefer } = {}) {
  const url = `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`;
  const init = {
    method,
    headers: headers(prefer ? { Prefer: prefer } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  };

  /* One retry on a gateway hiccup. Every call here is safe to repeat. */
  for (let attempt = 0; ; attempt += 1) {
    let res;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      if (attempt === 0) continue;
      err.transient = true;
      throw err;
    }
    const text = await res.text();
    const parsed = text ? JSON.parse(text) : null;
    if (res.ok) return parsed;
    const err = restError(res.status, parsed);
    if (err.transient && attempt === 0) continue;
    throw err;
  }
}

/** Call a SQL function exposed at /rpc/<name>. */
function rpc(name, args) {
  return rest(`rpc/${name}`, { method: "POST", body: args });
}

module.exports = { hasRestApi, rest, rpc };
