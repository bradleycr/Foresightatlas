/**
 * Express API for local mock development (file-backed storage).
 *
 * Uses JSON files under `mock/*.local.json` so data is easy to inspect/edit.
 * Production on Vercel uses `api/` handlers and does not use this entrypoint.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const fs = require("fs").promises;
const cors = require("cors");
const { mergeSheetEventsWithLuma } = require("./luma-merge");
const {
  getLocalDatabase,
  getMockCalendarEvents,
  authenticateLocalMember,
  changeLocalMemberPassword,
  createLocalProfile,
  saveLocalProfile,
  listLocalRsvps,
  appendLocalRsvp,
  listLocalCheckins,
  appendLocalCheckin,
  appendLocalSuggestion,
  DATABASE_FILE,
  CALENDAR_FILE,
  LUMA_FILE,
} = require("./local-storage");
const { getDirectorySessionFromRequest } = require("./directory-auth");

const app = express();
const DEFAULT_PORT = 3001;
const VALID_CALENDAR_NODE_SLUGS = new Set(["berlin", "sf", "global"]);

function dedupeCalendarEvents(events) {
  const byKey = new Map();
  for (const event of events) {
    const key = `${String(event.title || "").trim().toLowerCase()}|${event.start}|${event.end}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, event);
      continue;
    }
    if (existing.source !== "google" && event.source === "google") {
      byKey.set(key, event);
    }
  }
  return Array.from(byKey.values());
}

function mapMockEventToCalendarEvent(event) {
  if (!event || typeof event !== "object") return null;
  const start =
    typeof event.start === "string"
      ? event.start
      : typeof event.startAt === "string"
        ? event.startAt
        : "";
  const end =
    typeof event.end === "string"
      ? event.end
      : typeof event.endAt === "string"
        ? event.endAt
        : "";
  if (!start || !end) return null;
  return {
    id: String(event.id || `mock-${start}`),
    title: String(event.title || "Untitled event"),
    start,
    end,
    location: event.location ? String(event.location) : null,
    invitedBy: event.invitedBy ? String(event.invitedBy) : null,
    description: event.description ? String(event.description) : null,
    externalLink: event.externalLink ? String(event.externalLink) : null,
    source: event.source === "google" ? "google" : "mock",
  };
}

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

app.get("/api/database", async (req, res) => {
  try {
    const database = await getLocalDatabase();
    database.events = await mergeSheetEventsWithLuma(database.events || []);
    return res.json(database);
  } catch (error) {
    console.error("Error reading local mock database:", error);
    return res.status(500).json({
      error: error?.message || "Failed to read local mock database.",
    });
  }
});

app.post("/api/database", async (_req, res) => {
  res.status(410).json({
    error: "POST /api/database is deprecated. Use profile routes for edits.",
  });
});

app.post("/api/member-login", async (req, res) => {
  try {
    const result = await authenticateLocalMember(
      req.body?.username,
      req.body?.password,
    );
    res.json(result);
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : "Sign-in failed",
    });
  }
});

app.post("/api/member-password", async (req, res) => {
  try {
    const session = getDirectorySessionFromRequest(req);
    const result = await changeLocalMemberPassword(
      session,
      req.body?.currentPassword,
      req.body?.newPassword,
    );
    res.json(result);
  } catch (error) {
    const status =
      error && typeof error === "object" && error.statusCode === 401 ? 401 : 400;
    res.status(status).json({
      error: error instanceof Error ? error.message : "Failed to change password",
    });
  }
});

app.post("/api/member-register", async (req, res) => {
  try {
    const { person, password } = req.body || {};
    const result = await createLocalProfile(person, password);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    res.status(400).json({ error: message });
  }
});

app.post("/api/profile", async (req, res) => {
  try {
    const session = getDirectorySessionFromRequest(req);
    const result = await saveLocalProfile(req.body?.person, session);
    res.json(result);
  } catch (error) {
    console.error("Error saving local mock profile:", error);
    const status =
      error && typeof error === "object" && error.statusCode === 401 ? 401 : 400;
    res.status(status).json({
      error: error instanceof Error ? error.message : "Failed to save profile",
    });
  }
});

app.get("/api/rsvps", async (_req, res) => {
  try {
    return res.json(await listLocalRsvps());
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to read RSVPs",
    });
  }
});

app.post("/api/rsvps", async (req, res) => {
  try {
    const row = await appendLocalRsvp(req.body || {});
    return res.status(201).json(row);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to save RSVP",
    });
  }
});

app.get("/api/checkins", async (req, res) => {
  try {
    const rows = await listLocalCheckins({
      nodeSlug: req.query?.nodeSlug,
      startDate: req.query?.startDate,
      endDate: req.query?.endDate,
    });
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to read check-ins",
    });
  }
});

app.post("/api/checkins", async (req, res) => {
  try {
    const row = await appendLocalCheckin(req.body || {});
    return res.status(201).json(row);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to save check-in",
    });
  }
});

app.post("/api/suggestions", async (req, res) => {
  try {
    const row = await appendLocalSuggestion(req.body || {});
    return res.status(201).json({
      id: row.id,
      status: row.status,
      message: "Suggestion submitted; stored in local mock database.",
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to submit suggestion",
    });
  }
});

app.get("/api/calendar-events", async (req, res) => {
  const rawNodeSlug = typeof req.query?.nodeSlug === "string" ? req.query.nodeSlug : "global";
  const nodeSlug = rawNodeSlug.trim().toLowerCase();
  if (!VALID_CALENDAR_NODE_SLUGS.has(nodeSlug)) {
    return res.status(400).json({ error: "Invalid nodeSlug. Use berlin, sf, or global." });
  }

  try {
    const calendarEvents = await getMockCalendarEvents();
    const database = await getLocalDatabase();
    database.events = await mergeSheetEventsWithLuma(database.events || []);

    const googleEvents = calendarEvents
      .filter((event) => event?.nodeSlug === nodeSlug)
      .map(mapMockEventToCalendarEvent)
      .filter(Boolean);
    const programmingEvents = (database.events || [])
      .filter((event) => event?.nodeSlug === nodeSlug)
      .map((event) => mapMockEventToCalendarEvent({ ...event, source: "mock" }))
      .filter(Boolean);

    const events = dedupeCalendarEvents([...googleEvents, ...programmingEvents]).sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );

    return res.json({
      source: "google",
      warning: "Using local mock Google Calendar feed plus mock programming/Luma events.",
      events,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to read mock calendar events",
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API route not found",
    path: req.method + " " + req.path,
  });
});

const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const indexFile = path.join(distPath, "index.html");
  fs.access(indexFile)
    .then(() => res.sendFile(indexFile))
    .catch(() => next());
});

if (require.main === module) {
  const portMin = Number(process.env.PORT) || DEFAULT_PORT;
  const hasExplicitPort =
    Number.isFinite(Number(process.env.PORT)) &&
    String(process.env.PORT).trim() !== "";
  const portMax = hasExplicitPort ? portMin : Math.min(portMin + 9, 3010);

  function tryListen(port) {
    const server = app.listen(port, () => {
      console.log(
        `Local mock API server running on http://localhost:${server.address().port}`,
      );
      console.log(`[local-mock] Database file: ${DATABASE_FILE}`);
      console.log(`[local-mock] Calendar file: ${CALENDAR_FILE}`);
      console.log(`[local-mock] Luma events file: ${LUMA_FILE}`);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE" && port < portMax) {
        tryListen(port + 1);
      } else {
        console.error(err);
        process.exit(1);
      }
    });
  }

  tryListen(portMin);
}

module.exports = app;

