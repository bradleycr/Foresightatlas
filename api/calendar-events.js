/**
 * Vercel serverless: GET /api/calendar-events
 *
 * Returns events for a node-backed shared Google Calendar.
 * Query: nodeSlug=berlin|sf|global
 */

const fs = require("fs");
const path = require("path");

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credPath && !fs.existsSync(path.resolve(credPath))) {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const { google } = require("googleapis");

const VALID_NODE_SLUGS = new Set(["berlin", "sf", "global"]);
const DAY_MS = 24 * 60 * 60 * 1000;

function getCalendarIdForNode(nodeSlug) {
  if (nodeSlug === "berlin") return process.env.GOOGLE_CALENDAR_ID_BERLIN || "";
  if (nodeSlug === "sf") return process.env.GOOGLE_CALENDAR_ID_SF || "";
  return process.env.GOOGLE_CALENDAR_ID_GLOBAL || "";
}

function toIsoDate(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.dateTime === "string" && value.dateTime.trim()) {
    const d = new Date(value.dateTime);
    if (Number.isFinite(d.getTime())) return d.toISOString();
    return null;
  }
  if (typeof value.date === "string" && value.date.trim()) {
    const d = new Date(`${value.date}T00:00:00.000Z`);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  return null;
}

function normalizeGoogleEvent(item) {
  const start = toIsoDate(item.start);
  const end = toIsoDate(item.end);
  if (!start || !end) return null;
  return {
    id: String(item.id || `gcal-${start}`),
    title: String(item.summary || "Untitled event"),
    start,
    end,
    location: item.location ? String(item.location) : null,
    invitedBy:
      (item.creator && (item.creator.displayName || item.creator.email))
        ? String(item.creator.displayName || item.creator.email)
        : (item.organizer && (item.organizer.displayName || item.organizer.email))
          ? String(item.organizer.displayName || item.organizer.email)
          : null,
    description: item.description ? String(item.description) : null,
    externalLink: item.htmlLink ? String(item.htmlLink) : null,
    source: "google",
  };
}

function sortByStart(events) {
  return [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}

async function getCalendarClient() {
  const apiKey =
    process.env.GOOGLE_CALENDAR_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_SHEETS_API_KEY;
  if (apiKey) {
    const auth = new google.auth.GoogleAuth({ apiKey });
    return google.calendar({ version: "v3", auth });
  }

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let key = null;
  if (keyJson) {
    try {
      key = JSON.parse(keyJson);
    } catch {
      return null;
    }
  } else if (keyPath) {
    const resolved = path.resolve(keyPath);
    if (!fs.existsSync(resolved)) return null;
    try {
      key = JSON.parse(fs.readFileSync(resolved, "utf8"));
    } catch {
      return null;
    }
  }
  if (!key) return null;

  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
  return google.calendar({ version: "v3", auth });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const rawNodeSlug = typeof req.query?.nodeSlug === "string" ? req.query.nodeSlug : "global";
  const nodeSlug = rawNodeSlug.trim().toLowerCase();
  if (!VALID_NODE_SLUGS.has(nodeSlug)) {
    return res.status(400).json({ error: "Invalid nodeSlug. Use berlin, sf, or global." });
  }

  const calendarId = getCalendarIdForNode(nodeSlug);
  const calendarClient = await getCalendarClient();

  if (!calendarId || !calendarClient) {
    return res.status(503).json({
      error:
        "Google Calendar is not configured. Set GOOGLE_CALENDAR_ID_BERLIN/GOOGLE_CALENDAR_ID_SF/GOOGLE_CALENDAR_ID_GLOBAL plus calendar read credentials.",
    });
  }

  try {
    const { data } = await calendarClient.events.list({
      calendarId,
      singleEvents: true,
      orderBy: "startTime",
      timeMin: new Date(Date.now() - 30 * DAY_MS).toISOString(),
      timeMax: new Date(Date.now() + 365 * DAY_MS).toISOString(),
      maxResults: 2500,
    });

    const events = sortByStart(
      (data.items || []).map(normalizeGoogleEvent).filter(Boolean),
    );
    return res.status(200).json({ source: "google", events });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to read Google Calendar events.",
    });
  }
};
