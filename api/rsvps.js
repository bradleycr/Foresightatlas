/**
 * Vercel serverless: GET = read RSVPs from sheet (API key). POST = append one RSVP (service account).
 * Env: SPREADSHEET_ID, GOOGLE_SHEETS_API_KEY (read), GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS (write).
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ";
const SHEET_RSVPS = "RSVPs";

function parseRsvpRows(values) {
  if (!values || values.length < 2) return [];
  const [headerRow, ...rows] = values;
  const col = (name) => {
    const i = headerRow.findIndex((c) => String(c).trim().toLowerCase() === name.toLowerCase());
    return i >= 0 ? i : -1;
  };
  const validStatus = (s) => (s === "interested" || s === "not-going" ? s : "going");
  const list = rows
    .map((row) => {
      const eventId = row[col("eventId")] != null ? String(row[col("eventId")]).trim() : "";
      const personId = row[col("personId")] != null ? String(row[col("personId")]).trim() : "";
      if (!eventId || !personId) return null;
      const rawStatus = row[col("status")] != null ? String(row[col("status")]).trim() : "";
      return {
        eventId,
        eventTitle: row[col("eventTitle")] != null ? String(row[col("eventTitle")]).trim() : "",
        personId,
        fullName: row[col("fullName")] != null ? String(row[col("fullName")]).trim() : "",
        status: validStatus(rawStatus || "going"),
        createdAt: row[col("createdAt")] != null ? String(row[col("createdAt")]).trim() : new Date().toISOString(),
        updatedAt: row[col("updatedAt")] != null ? String(row[col("updatedAt")]).trim() : new Date().toISOString(),
      };
    })
    .filter(Boolean);
  // Sheet is append-only: same person can have multiple rows per event. Keep one per (eventId, personId), latest by updatedAt.
  const byKey = new Map();
  for (const r of list) {
    const key = `${r.eventId}\t${r.personId}`;
    const existing = byKey.get(key);
    if (!existing || new Date(r.updatedAt) > new Date(existing.updatedAt)) byKey.set(key, r);
  }
  return Array.from(byKey.values());
}

async function getSheetsClientForRead() {
  const key = process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return null;
  const auth = new google.auth.GoogleAuth({ apiKey: key });
  return google.sheets({ version: "v4", auth });
}

async function getSheetsClientForWrite() {
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

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    const sheets = await getSheetsClientForRead();
    if (!sheets) return res.status(503).json({ error: "RSVP read not configured (missing GOOGLE_SHEETS_API_KEY)" });
    try {
      const { data } = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_RSVPS}'!A:G`,
      });
      const rsvps = parseRsvpRows(data.values || []);
      return res.status(200).json(rsvps);
    } catch (e) {
      console.error("GET /api/rsvps", e.message);
      return res.status(500).json({ error: "Failed to read RSVPs" });
    }
  }

  if (req.method === "POST") {
    const sheets = await getSheetsClientForWrite();
    if (!sheets) return res.status(503).json({ error: "RSVP write not configured (missing GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS)" });
    const { eventId, eventTitle, personId, fullName, status } = req.body || {};
    if (!eventId || !personId) return res.status(400).json({ error: "eventId and personId required" });
    const validStatus = (s) => (s === "interested" || s === "not-going" ? s : "going");
    const statusToSave = validStatus(status || "going");
    const now = new Date().toISOString();
    const row = [eventId, eventTitle != null ? String(eventTitle).trim() : "", personId, fullName || "", statusToSave, now, now];
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_RSVPS}'!A:G`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
      return res.status(201).json({
        eventId,
        eventTitle: eventTitle != null ? String(eventTitle).trim() : "",
        personId,
        fullName: fullName || "",
        status: statusToSave,
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      console.error("POST /api/rsvps", e.message);
      return res.status(500).json({ error: "Failed to save RSVP" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
