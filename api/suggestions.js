/**
 * Vercel serverless: POST = append a suggestion (profile/location update) to the Suggestions sheet.
 * Env: SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_KEY (JSON) or GOOGLE_APPLICATION_CREDENTIALS (file path). Sheet must have Suggestions tab.
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ";
const SHEET_SUGGESTIONS = "Suggestions";
const SUGGESTION_HEADERS = ["id", "personName", "personEmailOrHandle", "requestedChangeType", "requestedPayload", "createdAt", "status"];

async function getSheetsClient() {
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
    try {
      key = JSON.parse(fs.readFileSync(path.resolve(keyPath), "utf8"));
    } catch (e) {
      console.error("GOOGLE_APPLICATION_CREDENTIALS read failed:", e.message);
      return null;
    }
  }
  if (!key) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function generateId() {
  return "s" + Date.now() + "-" + Math.random().toString(36).slice(2, 11);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const sheets = await getSheetsClient();
  if (!sheets) return res.status(503).json({ error: "Suggestions not configured (missing GOOGLE_SERVICE_ACCOUNT_KEY)" });

  const body = req.body || {};
  const { personName, personEmailOrHandle, requestedChangeType, requestedPayload } = body;
  if (!personName || !personEmailOrHandle || !requestedChangeType) {
    return res.status(400).json({ error: "personName, personEmailOrHandle, and requestedChangeType required" });
  }
  const id = generateId();
  const createdAt = new Date().toISOString();
  const status = "Pending";
  const payloadStr = typeof requestedPayload === "object" ? JSON.stringify(requestedPayload) : String(requestedPayload || "{}");
  const row = [id, personName, personEmailOrHandle, requestedChangeType, payloadStr, createdAt, status];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_SUGGESTIONS}'!A:G`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
    return res.status(201).json({ id, status: "Pending", message: "Suggestion submitted; a node manager will review it." });
  } catch (e) {
    console.error("POST /api/suggestions", e.message);
    return res.status(500).json({ error: "Failed to submit suggestion" });
  }
};
