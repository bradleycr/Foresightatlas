/**
 * HTTP client for the signal-cli-rest-api container.
 *
 * Wraps the two endpoints we care about:
 *   GET  /v1/receive/{number}          — poll for inbound messages
 *   POST /v2/send                      — send a reply to a group
 *
 * All network errors bubble up so the caller (poller) can handle retry logic.
 */

const SIGNAL_API_URL = () => process.env.SIGNAL_API_URL || "http://localhost:8080";
const SIGNAL_NUMBER = () => process.env.SIGNAL_NUMBER;

/**
 * Fetch pending messages from the Signal REST API.
 * Each call drains the queue — messages won't appear again.
 *
 * @returns {Promise<Array<{
 *   envelope: {
 *     source: string,
 *     sourceNumber: string,
 *     sourceName: string,
 *     timestamp: number,
 *     dataMessage?: { message: string, groupInfo?: { groupId: string } }
 *   }
 * }>>}
 */
async function receiveMessages() {
  const number = SIGNAL_NUMBER();
  if (!number) throw new Error("SIGNAL_NUMBER is not configured");

  const url = `${SIGNAL_API_URL()}/v1/receive/${encodeURIComponent(number)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Signal receive failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Send a text message to a Signal group.
 *
 * @param {string} groupId  — Base64-encoded group ID
 * @param {string} text     — Message body
 */
async function sendGroupMessage(groupId, text) {
  const number = SIGNAL_NUMBER();
  if (!number) throw new Error("SIGNAL_NUMBER is not configured");

  const url = `${SIGNAL_API_URL()}/v2/send`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      number,
      message: text,
      recipients: [groupId],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Signal send failed (${res.status}): ${body}`);
  }

  return res.json();
}

module.exports = { receiveMessages, sendGroupMessage };
