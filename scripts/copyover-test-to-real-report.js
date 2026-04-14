#!/usr/bin/env node
/**
 * Find usable data in the People (test/mock) tab that could fill gaps in Real Data.
 * Matches rows by fullName (normalized), then reports which fields in People have
 * values that Real Data is missing. Output: reports/REAL_DATA_COPYOVER_REPORT.md
 *
 * Run: node scripts/copyover-test-to-real-report.js
 * Requires: GOOGLE_SHEETS_API_KEY, SPREADSHEET_ID
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const path = require("path");
const { google } = require("googleapis");
const { SHEET_NAMES, PEOPLE_HEADERS } = require("./sheet-schema.js");
const fs = require("fs").promises;

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

function normalizeName(s) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function rowToPerson(row, options = {}) {
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
  const person = {
    id: get(idx("id")) || undefined,
    fullName: get(idx("fullName")),
    roleType: get(idx("roleType")) || "Fellow",
    fellowshipCohortYear: parseInt(row[idx("fellowshipCohortYear")], 10) || 0,
    fellowshipEndYear: Number.isNaN(fellowshipEndYear) ? null : fellowshipEndYear,
    affiliationOrInstitution: get(idx("affiliationOrInstitution")) || null,
    focusTags: Array.isArray(focusTags) ? focusTags : [],
    currentCity: get(idx("currentCity")),
    currentCountry: get(idx("currentCountry")),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    primaryNode: get(idx("primaryNode")) || "Global",
    profileUrl: get(idx("profileUrl")),
    contactUrlOrHandle: get(idx("contactUrlOrHandle")) || null,
    shortProjectTagline: get(idx("shortProjectTagline")),
    expandedProjectDescription: get(idx("expandedProjectDescription")),
    isAlumni: String(row[idx("isAlumni")]).toLowerCase() === "true",
  };
  if (options.assignIdPrefix && (!person.id || !String(person.id).trim())) {
    person.id = options.assignIdPrefix + (options.rowIndex != null ? options.rowIndex + 1 : "");
  }
  return person;
}

function parsePeopleRows(rows, options = {}) {
  if (!rows || rows.length < 2) return [];
  const [headerRow, ...dataRows] = rows;
  const colIndex = {};
  PEOPLE_HEADERS.forEach((h, i) => {
    colIndex[h] = headerRow[i] === h ? i : headerRow.findIndex((c) => String(c).trim() === h);
  });
  return dataRows
    .map((row, i) => {
      const ordered = PEOPLE_HEADERS.map((h) => row[colIndex[h]]);
      return rowToPerson(ordered, { ...options, rowIndex: i });
    })
    .filter((p) => p && (p.fullName != null && p.fullName !== ""));
}

function hasValue(v, isCoord = false) {
  if (v == null) return false;
  if (isCoord) return typeof v === "number" && Number.isFinite(v) && v !== 0;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
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
      return [];
    }
    throw err;
  }
}

async function main() {
  if (!API_KEY) {
    console.log("GOOGLE_SHEETS_API_KEY not set. Set it in .env.local to run this script.");
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({ apiKey: API_KEY });
  const sheets = google.sheets({ version: "v4", auth });

  console.log("Fetching People and RealData tabs...");
  const [peopleRows, realDataRows] = await Promise.all([
    fetchSheetRange(sheets, SHEET_NAMES.PEOPLE, "A:Q"),
    fetchSheetRange(sheets, SHEET_NAMES.REAL_DATA, "A:Q"),
  ]);

  const peopleTab = parsePeopleRows(peopleRows);
  const realData = parsePeopleRows(realDataRows, { assignIdPrefix: "realdata-" });

  const realByName = new Map();
  realData.forEach((p) => {
    const key = normalizeName(p.fullName);
    if (!realByName.has(key)) realByName.set(key, []);
    realByName.get(key).push(p);
  });

  const peopleByName = new Map();
  peopleTab.forEach((p) => {
    const key = normalizeName(p.fullName);
    if (!peopleByName.has(key)) peopleByName.set(key, []);
    peopleByName.get(key).push(p);
  });

  // Match: same normalized fullName
  const matchedPairs = [];
  for (const [nameKey, realList] of realByName) {
    const peopleList = peopleByName.get(nameKey);
    if (!peopleList || peopleList.length === 0) continue;
    realList.forEach((real) => {
      const testPerson = peopleList[0];
      matchedPairs.push({ real, test: testPerson, nameKey });
    });
  }

  const fieldsToConsider = [
    { key: "currentCity", label: "currentCity", coord: false },
    { key: "currentCountry", label: "currentCountry", coord: false },
    { key: "lat", label: "lat", coord: true },
    { key: "lng", label: "lng", coord: true },
    { key: "profileUrl", label: "profileUrl", coord: false },
    { key: "contactUrlOrHandle", label: "contactUrlOrHandle", coord: false },
    { key: "shortProjectTagline", label: "shortProjectTagline", coord: false },
    { key: "expandedProjectDescription", label: "expandedProjectDescription", coord: false },
    { key: "affiliationOrInstitution", label: "affiliationOrInstitution", coord: false },
    { key: "primaryNode", label: "primaryNode", coord: false },
    { key: "focusTags", label: "focusTags", coord: false },
  ];

  const copyableCount = {};
  const examples = {};
  fieldsToConsider.forEach((f) => {
    copyableCount[f.label] = 0;
    examples[f.label] = [];
  });

  matchedPairs.forEach(({ real, test }) => {
    fieldsToConsider.forEach(({ key, label, coord }) => {
      const realVal = coord ? (key === "lat" ? real.lat : real.lng) : real[key];
      const testVal = coord ? (key === "lat" ? test.lat : test.lng) : test[key];
      const realEmpty = !hasValue(realVal, coord);
      const testHas = hasValue(testVal, coord);
      if (realEmpty && testHas) {
        copyableCount[label]++;
        if (examples[label].length < 5) {
          examples[label].push({
            fullName: real.fullName,
            from: testVal,
          });
        }
      }
    });
  });

  const lines = [
    "# Copy-over report: People (test) tab → Real Data tab",
    "",
    "This report finds **matched rows by full name** between the People tab and the Real Data tab, then checks which fields in the People tab have values that could fill **empty** fields in Real Data.",
    "",
    "---",
    "## Summary",
    "",
    `- **People tab rows (with name):** ${peopleTab.length}`,
    `- **Real Data rows (with name):** ${realData.length}`,
    `- **Matched by fullName:** ${matchedPairs.length}`,
    "",
  ];

  if (matchedPairs.length === 0) {
    lines.push(
      "**No name matches** between the two tabs. The People tab likely contains mock names (e.g. Dr. Sarah Chen) and Real Data contains real names (e.g. Roman Bauer), so there is nothing to copy over by name matching.",
      "",
      "If you have another way to link rows (e.g. a shared ID column you can populate in Real Data from People), re-run with that logic.",
      ""
    );
  } else {
    lines.push("## Usable data: fields you can copy from People → Real Data", "");
    lines.push("For each field, **count** = number of *matched* Real Data rows that are empty and have a value in the People tab.", "");
    lines.push("| Field | Copyable count | Sample (fullName, value from People) |");
    lines.push("|-------|----------------|----------------------------------------|");
    fieldsToConsider.forEach(({ label }) => {
      const n = copyableCount[label];
      const ex = examples[label].slice(0, 3).map((e) => `${e.fullName}: "${String(e.from).slice(0, 40)}…"`).join("; ");
      lines.push(`| ${label} | ${n} | ${ex || "—"} |`);
    });
    lines.push("");
    lines.push("## How to copy over", "");
    lines.push("1. Open the [Foresight Map Database](https://docs.google.com/spreadsheets/d/1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ/edit) sheet.");
    lines.push("2. In the **Real Data** tab, for each matched row (same fullName as in People), paste or type the value from the **People** tab for the fields you want to bring over (e.g. lat, lng, profileUrl, currentCity, currentCountry).");
    lines.push("3. Run `pnpm run sync:sheet` to refresh the app.");
    lines.push("");
  }

  const outPath = path.join(__dirname, "../reports/REAL_DATA_COPYOVER_REPORT.md");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, lines.join("\n"), "utf8");
  console.log("Wrote", outPath);
  console.log("Matched by fullName:", matchedPairs.length);
  if (matchedPairs.length > 0) {
    fieldsToConsider.forEach(({ label }) => {
      if (copyableCount[label] > 0) console.log(`  ${label}: ${copyableCount[label]} copyable`);
    });
  }

  const wantCsv = process.argv.includes("--csv");
  if (wantCsv && matchedPairs.length > 0) {
    const csvHeaders = ["fullName", "currentCity", "currentCountry", "lat", "lng", "contactUrlOrHandle", "shortProjectTagline", "expandedProjectDescription", "focusTags"];
    const escape = (v) => {
      const s = v == null ? "" : String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const csvRows = [csvHeaders.join(",")];
    matchedPairs.forEach(({ real, test }) => {
      const city = !hasValue(real.currentCity) && hasValue(test.currentCity) ? test.currentCity : "";
      const country = !hasValue(real.currentCountry) && hasValue(test.currentCountry) ? test.currentCountry : "";
      const lat = !hasValue(real.lat, true) && hasValue(test.lat, true) ? test.lat : "";
      const lng = !hasValue(real.lng, true) && hasValue(test.lng, true) ? test.lng : "";
      const contact = !hasValue(real.contactUrlOrHandle) && hasValue(test.contactUrlOrHandle) ? test.contactUrlOrHandle : "";
      const tagline = !hasValue(real.shortProjectTagline) && hasValue(test.shortProjectTagline) ? test.shortProjectTagline : "";
      const desc = !hasValue(real.expandedProjectDescription) && hasValue(test.expandedProjectDescription) ? test.expandedProjectDescription : "";
      const tags = !hasValue(real.focusTags) && hasValue(test.focusTags) ? (Array.isArray(test.focusTags) ? JSON.stringify(test.focusTags) : test.focusTags) : "";
      if (!city && !country && !lat && !lng && !contact && !tagline && !desc && !tags) return;
      csvRows.push([real.fullName, city, country, lat, lng, contact, tagline, desc, tags].map(escape).join(","));
    });
    const csvPath = path.join(__dirname, "../reports/REAL_DATA_COPYOVER.csv");
    await fs.writeFile(csvPath, csvRows.join("\n"), "utf8");
    console.log("Wrote", csvPath, `(${csvRows.length - 1} rows with at least one value to copy)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
