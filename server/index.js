/**
 * Simple Express API Server for Database Operations
 * 
 * Handles reading and writing to the JSON database file.
 * Runs on port 3001 in development, can be deployed as a standalone server or serverless function.
 */

const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Path to database file
const DB_PATH = path.join(__dirname, "../public/data/database.json");

/**
 * GET /api/database
 * Read the entire database
 */
app.get("/api/database", async (req, res) => {
  try {
    const data = await fs.readFile(DB_PATH, "utf8");
    const database = JSON.parse(data);
    res.json(database);
  } catch (error) {
    console.error("Error reading database:", error);
    res.status(500).json({ error: "Failed to read database" });
  }
});

/**
 * POST /api/database
 * Write the entire database
 */
app.post("/api/database", async (req, res) => {
  try {
    const database = req.body;

    // Basic validation
    if (!database || typeof database !== "object") {
      return res.status(400).json({ error: "Invalid database format" });
    }

    // Ensure required arrays exist
    if (!Array.isArray(database.people)) {
      database.people = [];
    }
    if (!Array.isArray(database.travelWindows)) {
      database.travelWindows = [];
    }
    if (!Array.isArray(database.suggestions)) {
      database.suggestions = [];
    }
    if (!Array.isArray(database.adminUsers)) {
      database.adminUsers = [];
    }

    // Write to file
    await fs.writeFile(DB_PATH, JSON.stringify(database, null, 2), "utf8");

    res.json({ success: true, message: "Database saved successfully" });
  } catch (error) {
    console.error("Error writing database:", error);
    res.status(500).json({ error: "Failed to write database" });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Database API server running on http://localhost:${PORT}`);
  });
}

module.exports = app;


