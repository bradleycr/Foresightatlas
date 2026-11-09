"use strict";

/**
 * Judge seats. Each seat has a private link whose token is an HMAC of the
 * poll slug and seat number, so nothing has to be stored to verify it.
 *
 * A seat's ballot is keyed `judge:N`. Whoever opens that link, on whatever
 * device, edits the same single ballot — a seat can never vote twice.
 */

const crypto = require("crypto");

const JUDGE_SEATS = 3;

function signingSecret() {
  return (
    process.env.DIRECTORY_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.POLL_JUDGE_SECRET ||
    ""
  );
}

function judgeTokenForSeat(slug, seat) {
  const secret = signingSecret();
  if (!secret) return "";
  return crypto
    .createHmac("sha256", secret)
    .update(`poll-judge:v1:${String(slug || "").trim().toLowerCase()}:${seat}`)
    .digest("base64url")
    .slice(0, 28);
}

/** @returns {{ seat: number } | null} */
function verifyJudgeToken(slug, tokenRaw) {
  const token = String(tokenRaw || "").trim();
  if (!token || !signingSecret()) return null;
  const given = Buffer.from(token);
  for (let seat = 1; seat <= JUDGE_SEATS; seat += 1) {
    const expected = Buffer.from(judgeTokenForSeat(slug, seat));
    if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) {
      return { seat };
    }
  }
  return null;
}

function judgeBallotKey(seat) {
  return `judge:${seat}`;
}

function listJudgeLinks(slug, origin = "https://atlas.foresight.org") {
  const base = String(origin).replace(/\/$/, "");
  const links = [];
  for (let seat = 1; seat <= JUDGE_SEATS; seat += 1) {
    const token = judgeTokenForSeat(slug, seat);
    if (!token) continue;
    links.push({
      seat,
      url: `${base}/polls/${encodeURIComponent(slug)}/judge?t=${encodeURIComponent(token)}`,
    });
  }
  return links;
}

module.exports = { JUDGE_SEATS, verifyJudgeToken, judgeBallotKey, listJudgeLinks };
