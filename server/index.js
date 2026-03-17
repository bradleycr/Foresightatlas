/**
 * Simple Express API Server for Database Operations
 *
 * Handles reading and writing to the JSON database file.
 * Runs on port 3001 in development, can be deployed as a standalone server or serverless function.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const fs = require("fs").promises;
const cors = require("cors");
const { saveProfile, createProfile } = require("./profile-store");
const { getFullDatabaseFromSheet } = require("./sheet-database");
const { mergeSheetEventsWithLuma } = require("./luma-merge");
const {
  authenticateDirectoryLogin,
  changeDirectoryPassword,
  getDirectorySessionFromRequest,
} = require("./directory-auth");

const app = express();
const DEFAULT_PORT = 3001;

// Middleware
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

/**
 * GET /api/database
 * Always reads from the Google Sheet (source of truth).
 * Requires GOOGLE_SHEETS_API_KEY or GOOGLE_SERVICE_ACCOUNT_KEY.
 */
app.get("/api/database", async (req, res) => {
  try {
    const database = await getFullDatabaseFromSheet();
    database.events = await mergeSheetEventsWithLuma(database.events || []);
    return res.json(database);
  } catch (error) {
    console.error("Error reading database from sheet:", error);
    const msg = error?.message || "Failed to read database from sheet.";
    const hint =
      msg.includes("credentials") || msg.includes("configured")
        ? " Set GOOGLE_SHEETS_API_KEY (or GOOGLE_SERVICE_ACCOUNT_KEY) and SPREADSHEET_ID in .env.local. Share the sheet with 'Anyone with the link can view' for API key. See docs/SHEETS_SYNC.md."
        : "";
    res.status(503).json({ error: msg + hint });
  }
});

/**
 * POST /api/database — deprecated. Sheet is the source of truth; profile edits go via POST /api/profile.
 * Kept only for backwards compatibility; can be removed.
 */
app.post("/api/database", async (req, res) => {
  res.status(410).json({
    error: "POST /api/database is deprecated. The Google Sheet is the source of truth; use the profile page to edit data.",
  });
});

/**
 * POST /api/member-login
 * Server-validated member sign-in backed by RealData.
 */
app.post("/api/member-login", async (req, res) => {
  try {
    const result = await authenticateDirectoryLogin(
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

/**
 * POST /api/member-password
 * Change the signed-in member's password and clear first-login state.
 */
app.post("/api/member-password", async (req, res) => {
  try {
    const token = req.body?.token || req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const result = await changeDirectoryPassword(
      token,
      req.body?.currentPassword,
      req.body?.newPassword,
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to change password",
    });
  }
});

/**
 * POST /api/member-register
 * Self-register a new directory profile. Creates a row in the RealData sheet and returns a session.
 */
app.post("/api/member-register", async (req, res) => {
  try {
    const { person, password } = req.body || {};
    const result = await createProfile(person, password);
    return res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration failed";
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/profile
 * Save the signed-in user's profile to the Google Sheet (RealData). Requires GOOGLE_SERVICE_ACCOUNT_KEY.
 */
app.post("/api/profile", async (req, res) => {
  try {
    const session = getDirectorySessionFromRequest(req);
    const result = await saveProfile(req.body?.person, session);
    res.json(result);
  } catch (error) {
    console.error("Error saving profile:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to save profile",
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Explicit 404 for unmatched /api routes (return JSON so frontend can show a clear message)
app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API route not found",
    path: req.method + " " + req.path,
  });
});

// SPA fallback: serve index.html for non-API GET so opening localhost:3001 shows the app (after build).
// In dev, use http://localhost:3000 for the app; 3001 is API-only.
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const indexFile = path.join(distPath, "index.html");
  fs.access(indexFile)
    .then(() => res.sendFile(indexFile))
    .catch(() => next());
});

// Start server
if (require.main === module) {
  const portMin = Number(process.env.PORT) || DEFAULT_PORT;
  const portMax = Math.min(portMin + 9, 3010);

  function tryListen(port) {
    const server = app.listen(port, () => {
      console.log(`Database API server running on http://localhost:${server.address().port}`);

      /* Auto-start the Signal check-in poller when all required env vars are present */
      if (process.env.SIGNAL_API_URL && process.env.SIGNAL_NUMBER && process.env.SIGNAL_GROUP_ID && process.env.SIGNAL_NODE_SLUG) {
        try {
          const { boot } = require("./signal/index");
          boot();
        } catch (err) {
          console.error("[server] Signal poller failed to start:", err.message);
        }
      }
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
