/**
 * Signal message polling loop.
 *
 * Periodically calls the signal-cli-rest-api receive endpoint, filters for
 * messages in the configured group, and dispatches /checkin commands to the
 * handler. Exponential backoff on transient failures; graceful shutdown on
 * SIGTERM / SIGINT so Docker stop works cleanly.
 */

const { receiveMessages, sendGroupMessage } = require("./signal-client");
const { handleCheckin, isCheckinCommand } = require("./checkin-handler");

const DEFAULT_POLL_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;
const BACKOFF_MULTIPLIER = 2;

/**
 * @param {{
 *   groupId: string,
 *   nodeSlug: string,
 *   pollIntervalMs?: number,
 *   onError?: (err: Error) => void,
 * }} opts
 * @returns {{ stop: () => void }}
 */
function startPoller(opts) {
  const {
    groupId,
    nodeSlug,
    pollIntervalMs = DEFAULT_POLL_MS,
    onError = (err) => console.error("[signal-poller] error:", err.message),
  } = opts;

  let running = true;
  let currentBackoff = pollIntervalMs;
  let timer = null;

  async function tick() {
    if (!running) return;

    try {
      const messages = await receiveMessages();
      currentBackoff = pollIntervalMs;

      if (process.env.SIGNAL_LOG_VERBOSE === "1") {
        console.log("[signal-poller] poll", { inbox: messages.length, nodeSlug });
      }

      for (const msg of messages) {
        const envelope = msg.envelope || msg;
        const data = envelope.dataMessage;
        if (!data || !data.message) continue;

        /* Only process messages from the configured group */
        const msgGroupId = data.groupInfo?.groupId;
        if (msgGroupId !== groupId) continue;

        const text = data.message.trim();
        if (!isCheckinCommand(text)) continue;

        const senderPhone = envelope.sourceNumber || envelope.source || "";
        const senderName = envelope.sourceName || senderPhone;

        try {
          const reply = await handleCheckin({
            messageText: text,
            senderPhone,
            senderName,
            groupId,
            nodeSlug,
          });

          if (reply) {
            await sendGroupMessage(groupId, reply);
            console.log("[signal-poller] checkin command processed", { nodeSlug });
          }
        } catch (handleErr) {
          console.error("[signal-poller] handler error:", handleErr);
          try {
            await sendGroupMessage(
              groupId,
              `Sorry ${senderName}, something went wrong processing your check-in. Please try again.`,
            );
          } catch { /* swallow send errors for error replies */ }
        }
      }
    } catch (err) {
      onError(err);
      currentBackoff = Math.min(currentBackoff * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
    }

    if (running) {
      timer = setTimeout(tick, currentBackoff);
    }
  }

  /* Kick off the first poll */
  timer = setTimeout(tick, 0);

  function stop() {
    running = false;
    if (timer) clearTimeout(timer);
    console.log("[signal-poller] stopped.");
  }

  return { stop };
}

module.exports = { startPoller };
