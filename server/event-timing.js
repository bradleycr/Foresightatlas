/**
 * Shared event timing for API/server RSVP guards.
 * Mirrors src/utils/eventTiming.ts: an event is past once its end has passed.
 */

function getEventEndMs(event) {
  if (!event) return NaN;
  const end = new Date(event.endAt).getTime();
  if (Number.isFinite(end)) return end;
  const start = new Date(event.startAt);
  if (!Number.isFinite(start.getTime())) return NaN;
  start.setHours(23, 59, 59, 999);
  return start.getTime();
}

function isEventPast(event, now = new Date()) {
  const endMs = getEventEndMs(event);
  if (!Number.isFinite(endMs)) return false;
  return endMs < now.getTime();
}

/**
 * Whether a write is allowed for this event.
 * Withdraws are always allowed (cleanup). Active RSVPs are never allowed after end.
 */
function canWriteRsvpStatus(event, status) {
  const normalised = String(status || "").trim();
  if (normalised === "withdrawn") return { ok: true };
  if (!event) return { ok: true };
  if (isEventPast(event)) {
    return {
      ok: false,
      error: "This event has ended. You can't RSVP for past events.",
    };
  }
  return { ok: true };
}

module.exports = {
  getEventEndMs,
  isEventPast,
  canWriteRsvpStatus,
};
