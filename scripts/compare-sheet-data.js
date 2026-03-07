#!/usr/bin/env node
/**
 * Compare people data: current database.json (mock/legacy) vs People tab vs Real Data tab.
 * Fetches both sheet tabs, parses with the same schema as sync-sheet-to-json, and writes
 * a markdown dossier to docs/DATA_COMPARISON_DOSSIER.md.
 *
 * Run: node scripts/compare-sheet-data.js
 * Requires: GOOGLE_SHEETS_API_KEY, SPREADSHEET_ID (same as sync:sheet)
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs").promises;
const path = require("path");
const { google } = require("googleapis");
const {
  SHEET_NAMES,
  REAL_DATA_TAB_NAMES,
  PEOPLE_HEADERS,
  PEOPLE_SHEET_WIDTH,
} = require("./sheet-schema.js");

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ";
const API_KEY =
  process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY;

function parseJsonSafe(str, fallback) {
  if (str == null || String(str).trim() === "") return fallback;
  try {
    return JSON.parse(String(str));
  } catch {
    return fallback;
  }
}

function rowToPerson(row) {
  const get = (i) => (row[i] != null ? String(row[i]).trim() : "");
  const idx = (name) => PEOPLE_HEADERS.indexOf(name);
  const focusTags = parseJsonSafe(row[idx("focusTags")], []);
  const lat = parseFloat(row[idx("lat")]);
  const lng = parseFloat(row[idx("lng")]);
  const fellowshipEndYearRaw = row[idx("fellowshipEndYear")];
  const fellowshipEndYear =
    fellowshipEndYearRaw === "" || fellowshipEndYearRaw == null
      ? null
      : parseInt(String(fellowshipEndYearRaw), 10);
  return {
    id: get(idx("id")) || undefined,
    fullName: get(idx("fullName")),
    roleType: get(idx("roleType")) || "Fellow",
    fellowshipCohortYear: parseInt(row[idx("fellowshipCohortYear")], 10) || 0,
    fellowshipEndYear: Number.isNaN(fellowshipEndYear) ? null : fellowshipEndYear,
    affiliationOrInstitution: get(idx("affiliationOrInstitution")) || null,
    focusTags: Array.isArray(focusTags) ? focusTags : [],
    currentCity: get(idx("currentCity")),
    currentCountry: get(idx("currentCountry")),
    currentCoordinates: {
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
    },
    primaryNode: get(idx("primaryNode")) || "Global",
    profileUrl: get(idx("profileUrl")),
    contactUrlOrHandle: get(idx("contactUrlOrHandle")) || null,
    shortProjectTagline: get(idx("shortProjectTagline")),
    expandedProjectDescription: get(idx("expandedProjectDescription")),
    isAlumni: String(row[idx("isAlumni")]).toLowerCase() === "true",
  };
}

function rowsToPeople(rows) {
  if (!rows || rows.length < 2) return { people: [], headerRow: [], rawRowCount: 0 };
  const [headerRow, ...dataRows] = rows;
  const colIndex = {};
  PEOPLE_HEADERS.forEach((h, i) => {
    colIndex[h] = headerRow[i] === h ? i : headerRow.findIndex((c) => String(c).trim() === h);
  });
  const people = dataRows
    .map((row, i) => {
      const ordered = PEOPLE_HEADERS.map((h) => row[colIndex[h]]);
      const person = rowToPerson(ordered);
      if (person && (person.fullName != null && person.fullName !== "")) {
        if (!person.id || String(person.id).trim() === "") {
          person.id = "realdata-" + (i + 1);
        }
        return person;
      }
      return null;
    })
    .filter(Boolean);
  return { people, headerRow: headerRow || [], rawRowCount: dataRows.length };
}

async function fetchSheetRange(sheets, sheetName, range) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!${range}`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    return res.data.values || [];
  } catch (err) {
    if (err.code === 400 && err.message?.includes("Unable to parse range")) {
      return null;
    }
    throw err;
  }
}

function countBy(arr, key) {
  const m = new Map();
  for (const x of arr) {
    const v = x[key] ?? "(blank)";
    m.set(v, (m.get(v) || 0) + 1);
  }
  return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
}

function summarizeFieldCoverage(people, field, isCoord) {
  let withValue = 0;
  for (const p of people) {
    const v = isCoord ? p.currentCoordinates?.[field] : p[field];
    if (v != null && v !== "" && (isCoord ? typeof v === "number" && v !== 0 : true)) {
      withValue++;
    }
  }
  return { withValue, pct: people.length ? ((withValue / people.length) * 100).toFixed(1) : "0" };
}

async function main() {
  const dbPath = path.join(__dirname, "../public/data/database.json");
  let currentPeople = [];
  try {
    const raw = await fs.readFile(dbPath, "utf8");
    const db = JSON.parse(raw);
    currentPeople = db.people || [];
  } catch (e) {
    console.warn("Could not load database.json:", e.message);
  }

  let peopleTabRows = null;
  let realDataRows = null;
  if (API_KEY) {
    const auth = new google.auth.GoogleAuth({ apiKey: API_KEY });
    const sheets = google.sheets({ version: "v4", auth });
    console.log("Fetching People and Real Data tabs...");
    [peopleTabRows, realDataRows] = await Promise.all([
      fetchSheetRange(sheets, SHEET_NAMES.PEOPLE, `A:${PEOPLE_SHEET_WIDTH}`),
      (async () => {
        for (const tabName of REAL_DATA_TAB_NAMES) {
          const rows = await fetchSheetRange(sheets, tabName, `A:${PEOPLE_SHEET_WIDTH}`);
          if (rows && rows.length >= 2) return rows;
        }
        return null;
      })(),
    ]);
  } else {
    console.log("GOOGLE_SHEETS_API_KEY not set — using only current database.json for comparison.");
  }

  const current = currentPeople;
  const peopleTab = peopleTabRows && peopleTabRows.length >= 2
    ? rowsToPeople(peopleTabRows)
    : { people: [], headerRow: [], rawRowCount: 0 };
  const realData = realDataRows && realDataRows.length >= 2
    ? rowsToPeople(realDataRows)
    : { people: [], headerRow: [], rawRowCount: 0 };

  const currentIds = new Set(current.map((p) => p.id).filter(Boolean));
  const peopleTabIds = new Set(peopleTab.people.map((p) => p.id).filter(Boolean));
  const realIds = new Set(realData.people.map((p) => p.id).filter(Boolean));

  const onlyInCurrent = [...currentIds].filter((id) => !realIds.has(id) && !peopleTabIds.has(id));
  const onlyInPeopleTab = [...peopleTabIds].filter((id) => !realIds.has(id));
  const onlyInRealData = [...realIds].filter((id) => !currentIds.has(id) && !peopleTabIds.has(id));
  const inBothCurrentAndReal = [...currentIds].filter((id) => realIds.has(id));
  const inBothPeopleTabAndReal = [...peopleTabIds].filter((id) => realIds.has(id));

  const roleCurrent = countBy(current, "roleType");
  const rolePeopleTab = countBy(peopleTab.people, "roleType");
  const roleReal = countBy(realData.people, "roleType");

  const nodeCurrent = countBy(current, "primaryNode");
  const nodePeopleTab = countBy(peopleTab.people, "primaryNode");
  const nodeReal = countBy(realData.people, "primaryNode");

  const currentNames = new Set(current.map((p) => (p.fullName || "").trim().toLowerCase()));
  const realNames = new Set(realData.people.map((p) => (p.fullName || "").trim().toLowerCase()));
  const nameOverlap = [...currentNames].filter((n) => n && realNames.has(n)).length;

  const dossierDir = path.join(__dirname, "../docs");
  await fs.mkdir(dossierDir, { recursive: true });
  const outPath = path.join(dossierDir, "DATA_COMPARISON_DOSSIER.md");

  const lines = [
    "# Data comparison dossier: Mock / People tab vs Real Data",
    "",
    "**Source of truth:** Real Data tab in the Foresight Map spreadsheet.",
    "This dossier compares the current app data (mock/legacy), the **People** tab, and the **Real Data** tab.",
    "",
    "---",
    "## 1. Row and record counts",
    "",
    "| Source | Rows in sheet | Records with valid ID (used in app) |",
    "|--------|----------------|--------------------------------------|",
    `| Current database.json (mock/legacy) | — | **${current.length}** |`,
    `| People tab | ${peopleTab.rawRowCount} | **${peopleTab.people.length}** |`,
    `| Real Data tab | ${realData.rawRowCount} | **${realData.people.length}** |`,
    "",
    "---",
    "## 2. ID overlap",
    "",
    "- **IDs only in current DB (not in Real Data or People):** " + onlyInCurrent.length,
    "- **IDs only in People tab (not in Real Data):** " + onlyInPeopleTab.length,
    "- **IDs only in Real Data (new):** " + onlyInRealData.length,
    "- **IDs in both current DB and Real Data:** " + inBothCurrentAndReal.length,
    "- **IDs in both People tab and Real Data:** " + inBothPeopleTabAndReal.length,
    "",
  ];

  if (onlyInCurrent.length > 0 && onlyInCurrent.length <= 30) {
    lines.push("Sample IDs only in current DB: `" + onlyInCurrent.slice(0, 15).join("`, `") + "`");
    if (onlyInCurrent.length > 15) lines.push("… and " + (onlyInCurrent.length - 15) + " more.");
    lines.push("");
  } else if (onlyInCurrent.length > 30) {
    lines.push("Sample IDs only in current DB (first 20): `" + onlyInCurrent.slice(0, 20).join("`, `") + "` … and " + (onlyInCurrent.length - 20) + " more.");
    lines.push("");
  }

  if (onlyInRealData.length > 0 && onlyInRealData.length <= 25) {
    lines.push("Sample IDs only in Real Data: `" + onlyInRealData.slice(0, 15).join("`, `") + "`");
    if (onlyInRealData.length > 15) lines.push("… and " + (onlyInRealData.length - 15) + " more.");
    lines.push("");
  }

  lines.push(
    "---",
    "## 3. Role type distribution",
    "",
    "| roleType | Current DB | People tab | Real Data |",
    "|----------|------------|------------|-----------|"
  );
  const allRoles = new Set([
    ...Object.keys(roleCurrent),
    ...Object.keys(rolePeopleTab),
    ...Object.keys(roleReal),
  ]);
  for (const r of [...allRoles].sort()) {
    lines.push(
      `| ${r} | ${roleCurrent[r] ?? "—"} | ${peopleTab.people.length ? (rolePeopleTab[r] ?? "—") : "—"} | ${realData.people.length ? (roleReal[r] ?? "—") : "—"} |`
    );
  }
  lines.push("");

  lines.push(
    "---",
    "## 4. Primary node distribution",
    "",
    "| primaryNode | Current DB | People tab | Real Data |",
    "|-------------|------------|------------|-----------|"
  );
  const allNodes = new Set([
    ...Object.keys(nodeCurrent),
    ...Object.keys(nodePeopleTab),
    ...Object.keys(nodeReal),
  ]);
  for (const n of [...allNodes].sort()) {
    lines.push(
      `| ${n} | ${nodeCurrent[n] ?? "—"} | ${peopleTab.people.length ? (nodePeopleTab[n] ?? "—") : "—"} | ${realData.people.length ? (nodeReal[n] ?? "—") : "—"} |`
    );
  }
  lines.push("");

  lines.push(
    "---",
    "## 5. Name overlap (current vs Real Data)",
    "",
    `Full names that appear in both current DB and Real Data: **${nameOverlap}**.`,
    `Current DB unique names: **${currentNames.size}**, Real Data unique names: **${realNames.size}**.`,
    ""
  );

  if (realData.people.length > 0) {
    lines.push(
      "---",
      "## 6. Field coverage (Real Data)",
      "",
      "Percentage of Real Data records with a non-empty value:",
      ""
    );
    const fields = [
      ["fullName", false],
      ["currentCity", false],
      ["currentCountry", false],
      ["primaryNode", false],
      ["profileUrl", false],
      ["shortProjectTagline", false],
      ["lat", true],
      ["lng", true],
    ];
    for (const [field, isCoord] of fields) {
      const s = summarizeFieldCoverage(realData.people, field, isCoord);
      lines.push(`- **${field}:** ${s.pct}% (${s.withValue}/${realData.people.length})`);
    }
    lines.push("");
  }

  if (peopleTab.headerRow.length || realData.headerRow.length) {
    lines.push(
      "---",
      "## 7. Sheet headers",
      "",
      "Expected People columns (schema): `" + PEOPLE_HEADERS.join("`, `") + "`.",
      ""
    );
    if (peopleTab.headerRow.length) {
      lines.push("**People tab** (first row): `" + (peopleTab.headerRow.slice(0, 17).join("`, `")) + "`.");
      lines.push("");
    }
    if (realData.headerRow.length) {
      lines.push("**Real Data tab** (first row): `" + (realData.headerRow.slice(0, 17).join("`, `")) + "`.");
      lines.push("");
    }
  }

  lines.push(
    "---",
    "## 8. Summary",
    "",
    "- **Source of truth:** RealData tab. The app sync now uses RealData only for people records.",
    "- **Sync command:** `pnpm run sync:sheet` (with GOOGLE_SHEETS_API_KEY set) writes Real Data → `public/data/database.json`.",
    "- **Legacy People tab:** retained only for migration comparison. Runtime people data should no longer depend on it.",
    "- **Travel Windows, Suggestions, Admin Users, RSVPs:** Still read from their existing tabs (TravelWindows, Suggestions, AdminUsers, RSVPs).",
    ""
  );

  await fs.writeFile(outPath, lines.join("\n"), "utf8");
  console.log("Wrote", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
