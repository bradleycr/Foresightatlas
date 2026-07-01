#!/usr/bin/env node
/**
 * One-time reconciliation: merge the latest Foresight Fellows roster export
 * (Year / Focus Area / Name / Email / Fellowship Type) into public/data/database.json.
 *
 * The roster is the newer source of truth for: cohort year, focus area,
 * contact email, and fellowship type (Regular vs Senior). Where a person
 * already exists in the database we update the contradicting fields;
 * where they don't exist yet we append a new record using the same
 * "location not yet known" placeholder shape already used for every
 * other real (non-demo) roster entry in the file.
 *
 * Usage: node scripts/data-import/apply-roster-update.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../../public/data/database.json");
const ROSTER_PATH = path.join(__dirname, "roster-2026-update.tsv");
const DRY_RUN = process.argv.includes("--dry-run");

/** Focus Area code (as it appears in the roster export) -> canonical focusTags value used across the app. */
const FOCUS_TAG_MAP = {
  AI: "Secure AI",
  Bio: "Longevity Biotechnology",
  "Ex Hope": "Existential Hope",
  Nano: "Nanotechnology",
  Neuro: "Neurotechnology",
  Space: "Space",
};

/** Roster years are cohort labels; the app's "current" cohort is the most recent one in the sheet. */
const CURRENT_COHORT_YEAR = 2026;
/** Senior Fellows have no single cohort year in the roster; anchor them at the program's earliest known year so they show up for every year filter (fellowshipEndYear stays null = ongoing). */
const SENIOR_FELLOW_ANCHOR_YEAR = 2017;

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents (Léo -> Leo, Jakubová -> Jakubova)
    .replace(/^(dr\.?|prof\.?)\s+/i, "")
    .replace(/["'’]/g, "")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRoster(text) {
  return text
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim().length > 0)
    .map((line, i) => {
      const cols = line.split("\t");
      const [yearRaw, focusCode, name, emailRaw, fellowshipType] = cols;
      const year = yearRaw && yearRaw.trim() ? parseInt(yearRaw.trim(), 10) : null;
      const email = (emailRaw || "").trim();
      return {
        line: i + 1,
        year,
        focusCode: (focusCode || "").trim(),
        name: (name || "").trim(),
        email,
        fellowshipType: (fellowshipType || "").trim(),
      };
    })
    .filter((r) => r.name);
}

function nextPersonId(people) {
  let max = 0;
  for (const p of people) {
    const m = /^p(\d+)$/.exec(p.id || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return () => `p${++max}`;
}

function main() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  const roster = parseRoster(fs.readFileSync(ROSTER_PATH, "utf8"));

  const byNormName = new Map();
  db.people.forEach((p) => {
    const key = normalizeName(p.fullName);
    // Keep the first match; flag collisions separately (none expected in this dataset).
    if (!byNormName.has(key)) byNormName.set(key, []);
    byNormName.get(key).push(p);
  });

  const genId = nextPersonId(db.people);

  const report = {
    updated: [],
    unchanged: [],
    added: [],
    ambiguous: [],
  };

  for (const row of roster) {
    const focusTag = FOCUS_TAG_MAP[row.focusCode];
    if (!focusTag) {
      console.warn(`Unknown focus code "${row.focusCode}" for ${row.name} (line ${row.line}) — skipping focus tag.`);
    }
    const isSenior = /senior/i.test(row.fellowshipType);
    const key = normalizeName(row.name);
    const matches = byNormName.get(key) || [];

    if (matches.length > 1) {
      report.ambiguous.push({ name: row.name, count: matches.length });
      continue;
    }

    if (matches.length === 1) {
      const person = matches[0];
      const changes = [];

      if (row.year != null && person.fellowshipCohortYear !== row.year) {
        changes.push(`cohort year ${person.fellowshipCohortYear} -> ${row.year}`);
        person.fellowshipCohortYear = row.year;
      }

      if (focusTag && !(person.focusTags || []).includes(focusTag)) {
        changes.push(`focusTags ${JSON.stringify(person.focusTags)} -> ${JSON.stringify([focusTag])}`);
        person.focusTags = [focusTag];
      }

      if (row.email && person.contactUrlOrHandle !== row.email) {
        changes.push(`email "${person.contactUrlOrHandle}" -> "${row.email}"`);
        person.contactUrlOrHandle = row.email;
      }

      const desiredRole = isSenior ? "Senior Fellow" : person.roleType === "Grantee" || person.roleType === "Prize Winner" ? person.roleType : "Fellow";
      if (person.roleType !== desiredRole) {
        changes.push(`roleType ${person.roleType} -> ${desiredRole}`);
        person.roleType = desiredRole;
      }

      const desiredAlumni = isSenior ? false : (row.year != null ? row.year < CURRENT_COHORT_YEAR : person.isAlumni);
      if (person.isAlumni !== desiredAlumni) {
        changes.push(`isAlumni ${person.isAlumni} -> ${desiredAlumni}`);
        person.isAlumni = desiredAlumni;
      }

      if (isSenior && person.fellowshipEndYear !== null) {
        changes.push(`fellowshipEndYear ${person.fellowshipEndYear} -> null (ongoing Senior Fellow)`);
        person.fellowshipEndYear = null;
      }

      if (changes.length > 0) {
        report.updated.push({ name: row.name, id: person.id, changes });
      } else {
        report.unchanged.push(row.name);
      }
      continue;
    }

    // No existing record — add a new one using the same placeholder shape
    // already used for every other real (non-demo) roster entry.
    const cohortYear = row.year != null ? row.year : SENIOR_FELLOW_ANCHOR_YEAR;
    const newPerson = {
      id: genId(),
      fullName: row.name,
      roleType: isSenior ? "Senior Fellow" : "Fellow",
      fellowshipCohortYear: cohortYear,
      fellowshipEndYear: null,
      affiliationOrInstitution: null,
      focusTags: focusTag ? [focusTag] : [],
      currentCity: "Global",
      currentCountry: "Global",
      currentCoordinates: { lat: 0, lng: 0 },
      primaryNode: "Global",
      profileUrl: "",
      contactUrlOrHandle: row.email || null,
      shortProjectTagline: "",
      expandedProjectDescription: "",
      isAlumni: isSenior ? false : row.year < CURRENT_COHORT_YEAR,
    };
    db.people.push(newPerson);
    byNormName.set(key, [newPerson]);
    report.added.push({ name: row.name, id: newPerson.id, year: row.year, focusTag, role: newPerson.roleType });
  }

  console.log(`Roster rows parsed: ${roster.length}`);
  console.log(`Matched & unchanged: ${report.unchanged.length}`);
  console.log(`Matched & updated:   ${report.updated.length}`);
  console.log(`Newly added:         ${report.added.length}`);
  console.log(`Ambiguous (skipped): ${report.ambiguous.length}`);

  if (report.updated.length) {
    console.log("\n--- Updated people ---");
    report.updated.forEach((u) => console.log(`  [${u.id}] ${u.name}: ${u.changes.join("; ")}`));
  }
  if (report.ambiguous.length) {
    console.log("\n--- Ambiguous name matches (needs manual review, not touched) ---");
    report.ambiguous.forEach((a) => console.log(`  ${a.name} (${a.count} existing records share this name)`));
  }
  if (report.added.length) {
    console.log("\n--- Newly added people (sample of first 15) ---");
    report.added.slice(0, 15).forEach((a) => console.log(`  [${a.id}] ${a.name} — ${a.year ?? "Senior"} — ${a.focusTag} — ${a.role}`));
  }

  if (DRY_RUN) {
    console.log("\nDry run: database.json NOT written.");
    return;
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${DB_PATH} (${db.people.length} total people).`);
}

main();
