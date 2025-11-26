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

    // Validate suggestions structure before saving (production-ready validation)
    for (const suggestion of database.suggestions) {
      if (!suggestion.id || typeof suggestion.id !== 'string') {
        return res.status(400).json({ error: "Invalid suggestion: missing or invalid ID" });
      }
      if (!suggestion.personName || typeof suggestion.personName !== 'string') {
        return res.status(400).json({ error: "Invalid suggestion: missing or invalid personName" });
      }
      if (!suggestion.personEmailOrHandle || typeof suggestion.personEmailOrHandle !== 'string') {
        return res.status(400).json({ error: "Invalid suggestion: missing or invalid personEmailOrHandle" });
      }
      if (!suggestion.requestedChangeType || !['New entry', 'Update location', 'Add travel window'].includes(suggestion.requestedChangeType)) {
        return res.status(400).json({ error: "Invalid suggestion: missing or invalid requestedChangeType" });
      }
      if (!suggestion.requestedPayload || typeof suggestion.requestedPayload !== 'object') {
        return res.status(400).json({ error: "Invalid suggestion: missing or invalid requestedPayload" });
      }
      if (!suggestion.status || !['Pending', 'Accepted', 'Rejected'].includes(suggestion.status)) {
        return res.status(400).json({ error: "Invalid suggestion: missing or invalid status" });
      }
      if (!suggestion.createdAt || typeof suggestion.createdAt !== 'string') {
        return res.status(400).json({ error: "Invalid suggestion: missing or invalid createdAt" });
      }
    }

    // Write to file with comprehensive error handling
    try {
      await fs.writeFile(DB_PATH, JSON.stringify(database, null, 2), "utf8");
    } catch (writeError) {
      console.error("Error writing database file:", writeError);
      // Check if it's a permissions error
      if (writeError.code === 'EACCES' || writeError.code === 'EPERM') {
        return res.status(500).json({ error: "Permission denied: cannot write to database file" });
      }
      // Check if disk is full
      if (writeError.code === 'ENOSPC') {
        return res.status(500).json({ error: "Disk full: cannot save database" });
      }
      throw writeError; // Re-throw other errors
    }

    res.json({ success: true, message: "Database saved successfully" });
  } catch (error) {
    console.error("Error writing database:", error);
    // Don't expose internal error details in production
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? "Failed to write database" 
      : error.message;
    res.status(500).json({ error: errorMessage });
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
