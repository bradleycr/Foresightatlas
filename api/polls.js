/**
 * Vercel serverless: event polls.
 *
 * GET  /api/polls?admin=1          staff/member list (session)
 * GET  /api/polls?slug=k7m2xq      public vote/live payload
 * GET  /api/polls?ping=1           keeps the database awake (daily cron)
 * POST /api/polls                  { action: "create" | "update" | "vote" | "addProject", ... }
 *
 * Vote is public and anonymous (QR from a room). Create/update require a
 * directory session and the Foresight Team role.
 */

const {
  listAdminPolls,
  getPublicPoll,
  createPoll,
  updatePoll,
  castVote,
  addProject,
  pingPollStore,
} = require("../server/polls-store");
const { resolveVoter } = require("../server/polls/voter");

/**
 * Host actions only. Loaded on demand: directory auth pulls in the Sheets
 * client, and a phone that just wants to vote shouldn't wait for it on a
 * cold start.
 */
function requireSession(req) {
  const {
    readDirectoryTokenFromRequest,
    verifyDirectorySessionToken,
  } = require("../server/directory-auth");
  return verifyDirectorySessionToken(readDirectoryTokenFromRequest(req));
}

/** Database unreachable or overloaded — a retry, not the voter's fault. */
function isTransient(error) {
  if (error?.transient) return true;
  const code = String(error?.code || "");
  return (
    /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|57P01|53300|08\d{3})$/.test(code) ||
    /timeout|terminated|too many clients/i.test(String(error?.message || ""))
  );
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Foresight-Write-Secret");
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") {
      if (String(req.query?.ping || "") === "1") {
        await pingPollStore();
        return res.status(200).json({ ok: true });
      }
      if (String(req.query?.admin || "") === "1") {
        return res.status(200).json(await listAdminPolls(requireSession(req)));
      }
      const slug = String(req.query?.slug || req.query?.id || "").trim();
      if (!slug) {
        return res.status(400).json({ error: "Pass ?slug= for a poll, or ?admin=1 when signed in." });
      }
      const voter = resolveVoter(req, res, req.query?.voterKey);
      const poll = await getPublicPoll(slug, voter, { judgeToken: req.query?.judgeToken });
      return res.status(200).json({ poll, voterKey: voter.deviceKey });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const action = String(body.action || "").trim();
      if (action === "vote") {
        const voter = resolveVoter(req, res, body.voterKey);
        const poll = await castVote(
          {
            slug: body.slug || body.id,
            firstId: body.optionId,
            secondId: body.secondOptionId,
            thirdId: body.thirdOptionId,
            teamOptionId: body.teamOptionId,
            judgeToken: body.judgeToken,
          },
          voter,
          req,
        );
        return res.status(200).json({ poll, voterKey: voter.deviceKey });
      }
      if (action === "addProject") {
        const voter = resolveVoter(req, res, body.voterKey);
        const poll = await addProject(body, req, voter);
        return res.status(200).json({ poll, voterKey: voter.deviceKey });
      }
      const session = requireSession(req);
      if (action === "create") return res.status(201).json({ poll: await createPoll(session, body) });
      if (action === "update") return res.status(200).json({ poll: await updatePoll(session, body) });
      return res.status(400).json({ error: "Unknown action. Use create, update, vote, or addProject." });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error?.statusCode === 401) {
      return res.status(401).json({ error: "Sign in to manage polls." });
    }
    if (isTransient(error)) {
      console.error("api/polls: database unavailable:", error.code || error.message);
      return res.status(503).json({ error: "The poll is busy. Wait a few seconds and try again." });
    }
    if (error?.severity) {
      console.error("api/polls: database error:", error.code, error.message);
      return res.status(500).json({ error: "Poll request failed. Try again." });
    }
    if (!error?.statusCode) console.error("api/polls:", error?.message || error);
    return res.status(error?.statusCode || 400).json({
      error: error instanceof Error ? error.message : "Poll request failed.",
    });
  }
};
