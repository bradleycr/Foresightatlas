#!/usr/bin/env node
/**
 * Reconcile the canonical fellows roster (scripts/data/fellows-roster.tsv)
 * against the RealData sheet.
 *
 * The TSV is the **source of truth** for: full name, cohort year, focus area,
 * fellowship type (Regular → Fellow, Senior → Senior Fellow) and email.
 *
 * What it does:
 *   • ADD   — roster people missing from the sheet (new rows)
 *   • FIX   — existing rows whose role / year / focus / email disagree with the
 *             roster (the roster wins for those canonical fields ONLY; we never
 *             touch location, bios, photos, passwords, privacy, etc.)
 *   • REPORT — duplicates, roster gaps, and "extra" Fellow rows in the sheet
 *             that aren't on the roster (left untouched — could be grantees,
 *             nodees, or stale entries to review by hand)
 *
 * SAFE BY DEFAULT: dry-run prints a full report and writes nothing. Pass
 * --apply to write (batched, upsert-only — never deletes a row).
 *
 * Usage:
 *   node scripts/sync-fellows-roster.js              # dry-run report
 *   node scripts/sync-fellows-roster.js --apply      # write changes
 *
 * Env (from .env.local / .env): GOOGLE_SERVICE_ACCOUNT_KEY or
 *   GOOGLE_APPLICATION_CREDENTIALS (write access) + SPREADSHEET_ID.
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  getSpreadsheetId,
  PEOPLE_SHEET_WIDTH,
} = require("./sheet-schema");
const {
  loadRealDataRecords,
  cloneRecord,
  buildStablePersonId,
  personRecordToRow,
} = require("../server/realdata-store");

const ROSTER_PATH = path.resolve(__dirname, "data/fellows-roster.tsv");

/** Roster focus label → canonical preset focus tag used across the app. */
const FOCUS_MAP = {
  ai: "Secure AI",
  bio: "Longevity Biotechnology",
  nano: "Nanotechnology",
  neuro: "Neurotechnology",
  space: "Space",
  "ex hope": "Existential Hope",
};
const PRESET_FOCUS_TAGS = new Set(Object.values(FOCUS_MAP));

/**
 * Explicit aliases for people the sheet stores under a name that fuzzy matching
 * can't safely infer (nicknames, maiden names, or spelling differences). Maps
 * the roster spelling → the existing sheet spelling. A "⚠" note means the two
 * spellings genuinely differ and a human should pick the canonical one.
 */
const NAME_ALIASES = [
  ["AJ Kourabi", "Abduljawad Kourabi"],
  ["Ala Shaabana", "Ala"],
  ["Dmitrii Usynin", "Dima Usynin"],
  ["Elena Sergeyeva", "Elena Sergeeva"], // ⚠ spelling
  ["Georgios Kaissis", "George Kaissis"],
  ["Ghada Almashaqbeh", "Ghada"],
  ["Jim Seale", "James Seale"],
  ["Kostas Konstantinidis", "Konstantinos Konstantinidis"],
  ["Matthew Allcock", "Matt Allcock"],
  ["Mikayla Maki", "Mikayla"],
  ["Rob Meagley", "Dr Robert Meagly"], // ⚠ spelling (Meagley/Meagly)
  ["Mariëlle van Kouten", "Mariëlle van Kooten"], // ⚠ spelling (Kouten/Kooten)
  ["Romain Fontyne", "Romain Fontaine"], // ⚠ spelling (Fontyne/Fontaine)
  ["Yip Fai, Tse", "Yip Fai, Tsei"], // ⚠ spelling (Tse/Tsei)
];

const HONORIFICS = new Set(["dr", "mr", "mrs", "ms", "prof", "professor"]);
const NAME_PARTICLES = new Set(["von", "van", "de", "der", "den", "del", "di", "la", "le", "du"]);

function mapRole(type) {
  return String(type || "").trim().toLowerCase() === "senior"
    ? "Senior Fellow"
    : "Fellow";
}

/** Accent/punctuation-insensitive name folding for matching. */
function foldName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop "(née ...)" etc.
    .replace(/["'’]/g, " ")
    .replace(/[.,\-/_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Core tokens = folded words minus honorifics, particles, and lone initials. */
function coreTokens(value) {
  return foldName(value)
    .split(" ")
    .filter((t) => t.length > 1 && !HONORIFICS.has(t) && !NAME_PARTICLES.has(t));
}

function matchKeys(value) {
  const fold = foldName(value);
  const core = coreTokens(value);
  const keys = new Set([`full:${fold}`]);
  if (core.length >= 2) {
    keys.add(`sorted:${[...core].sort().join(" ")}`);
    keys.add(`firstlast:${core[0]}|${core[core.length - 1]}`);
  }
  return keys;
}

function parseRoster() {
  const raw = fs.readFileSync(ROSTER_PATH, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const [, ...dataLines] = lines; // drop header
  const seen = new Map();
  const duplicates = [];
  const entries = [];

  for (const line of dataLines) {
    const cols = line.split("\t");
    const yearRaw = (cols[0] || "").trim();
    const focusRaw = (cols[1] || "").trim();
    const name = (cols[2] || "").trim();
    const email = (cols[3] || "").trim();
    const typeRaw = (cols[4] || "").trim();
    if (!name) continue;

    const entry = {
      name,
      email,
      roleType: mapRole(typeRaw),
      year: /^\d{4}$/.test(yearRaw) ? Number.parseInt(yearRaw, 10) : 0,
      focusTag: FOCUS_MAP[focusRaw.toLowerCase()] || null,
      focusRaw,
    };

    const key = foldName(name);
    if (seen.has(key)) {
      duplicates.push({ name, existing: seen.get(key).name });
      // Prefer Senior, else the most recent year.
      const prev = seen.get(key);
      const preferNew =
        (entry.roleType === "Senior Fellow") !==
        (prev.roleType === "Senior Fellow")
          ? entry.roleType === "Senior Fellow"
          : entry.year > prev.year;
      if (preferNew) seen.set(key, entry);
      continue;
    }
    seen.set(key, entry);
    entries.push(entry);
  }

  return { entries: [...seen.values()], duplicates };
}

function computeFocusTags(existingTags, focusTag) {
  const existing = Array.isArray(existingTags) ? existingTags : [];
  if (!focusTag) return existing; // roster has no focus (some seniors) → leave as-is
  // Keep custom (non-preset) tags, drop other preset focus tags, ensure ours.
  const custom = existing.filter(
    (t) => !PRESET_FOCUS_TAGS.has(t) && t !== focusTag,
  );
  return [focusTag, ...custom];
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { entries, duplicates } = parseRoster();
  console.error(
    `Roster: ${entries.length} unique people (${duplicates.length} in-file duplicate name(s) collapsed).`,
  );

  const loaded = await loadRealDataRecords({ write: apply });
  const records = loaded.records;

  // Index sheet rows by every match key (full / sorted-core / first-last).
  const byKey = new Map();
  for (const record of records) {
    for (const key of matchKeys(record.person.fullName)) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(record);
    }
  }
  // Index by folded full name for explicit alias resolution.
  const byFold = new Map();
  for (const record of records) {
    const f = foldName(record.person.fullName);
    if (!byFold.has(f)) byFold.set(f, []);
    byFold.get(f).push(record);
  }
  const aliasToSheetFold = new Map(
    NAME_ALIASES.map(([roster, sheet]) => [foldName(roster), foldName(sheet)]),
  );

  /** Gather candidate sheet records for a roster name (dedup by rowNumber). */
  function findCandidates(name) {
    const found = new Map();
    const add = (rec) => found.set(rec.rowNumber, rec);
    const aliasFold = aliasToSheetFold.get(foldName(name));
    if (aliasFold) (byFold.get(aliasFold) || []).forEach(add);
    for (const key of matchKeys(name)) (byKey.get(key) || []).forEach(add);
    return [...found.values()];
  }

  const toAdd = [];
  const toUpdate = []; // { record, changes, matchedName }
  const variantMatches = []; // { roster, sheet, rowNumber } for fuzzy/alias hits
  const sheetDupGroups = []; // roster people matching >1 sheet row
  const matchedRowNumbers = new Set();

  for (const entry of entries) {
    const matches = findCandidates(entry.name);
    matches.forEach((m) => matchedRowNumbers.add(m.rowNumber));

    if (matches.length > 1) {
      sheetDupGroups.push({
        roster: entry.name,
        rows: matches.map((m) => `${m.person.fullName} (row ${m.rowNumber})`),
      });
    }

    if (matches.length === 0) {
      const person = {
        id: "",
        fullName: entry.name,
        roleType: entry.roleType,
        fellowshipCohortYear: entry.year,
        fellowshipEndYear: null,
        affiliationOrInstitution: null,
        focusTags: entry.focusTag ? [entry.focusTag] : [],
        currentCity: "",
        currentCountry: "",
        currentCoordinates: { lat: 0, lng: 0 },
        primaryNode: "Global",
        profileUrl: "",
        profileImageUrl: null,
        contactUrlOrHandle: null,
        calendarEmail: null,
        availabilityUrl: null,
        shortProjectTagline: "",
        expandedProjectDescription: "",
        isAlumni: false,
        isPrivate: false,
        email: entry.email,
      };
      person.id = buildStablePersonId(person, 0);
      toAdd.push({
        person,
        auth: {
          passwordHash: "",
          mustChangePassword: false,
          claimedAt: "",
          lastProfileUpdatedAt: "",
          lastPasswordChangedAt: "",
        },
      });
      continue;
    }

    // Reconcile the richest matching row (the one a member would have claimed).
    const target = matches
      .slice()
      .sort((a, b) => (b.auth.passwordHash ? 1 : 0) - (a.auth.passwordHash ? 1 : 0))[0];

    // Note when we matched a different spelling, so a human can eyeball it.
    if (foldName(target.person.fullName) !== foldName(entry.name)) {
      variantMatches.push({
        roster: entry.name,
        sheet: target.person.fullName,
        rowNumber: target.rowNumber,
      });
    }

    const updated = cloneRecord(target);
    const changes = [];

    if (updated.person.roleType !== entry.roleType) {
      changes.push(`role ${updated.person.roleType || "—"} → ${entry.roleType}`);
      updated.person.roleType = entry.roleType;
    }
    if (entry.year > 0 && updated.person.fellowshipCohortYear !== entry.year) {
      changes.push(
        `year ${updated.person.fellowshipCohortYear || "—"} → ${entry.year}`,
      );
      updated.person.fellowshipCohortYear = entry.year;
    }
    const nextTags = computeFocusTags(updated.person.focusTags, entry.focusTag);
    if (!arraysEqual(updated.person.focusTags, nextTags)) {
      changes.push(
        `focus [${updated.person.focusTags.join(", ") || "—"}] → [${nextTags.join(", ")}]`,
      );
      updated.person.focusTags = nextTags;
    }
    if (entry.email && (updated.person.email || "") !== entry.email) {
      changes.push(
        `email ${updated.person.email || "—"} → ${entry.email}`,
      );
      updated.person.email = entry.email;
    }

    if (changes.length > 0) toUpdate.push({ record: updated, changes });
  }

  // Fellow-role rows never matched by any roster person — these are the
  // actionable "extras" (stale fellows, mislabeled grantees, or junk rows).
  // Non-fellow roles (Grantee/Nodee/Team/Prize) are expected to be absent from
  // a *fellows* roster, so we don't flag them.
  const extras = records.filter(
    (r) =>
      !matchedRowNumbers.has(r.rowNumber) &&
      (r.person.roleType === "Fellow" || r.person.roleType === "Senior Fellow"),
  );

  const missingEmail = entries.filter((e) => !e.email).map((e) => e.name);

  /* ── Report ──────────────────────────────────────────────────────────── */
  const line = "─".repeat(64);
  console.log(`\n${line}\nFELLOWS ROSTER RECONCILIATION ${apply ? "(APPLY)" : "(DRY RUN)"}\n${line}`);
  console.log(`Sheet rows:             ${records.length}`);
  console.log(`Roster people:          ${entries.length}`);
  console.log(`To ADD (new):           ${toAdd.length}`);
  console.log(`To FIX (discrepancy):   ${toUpdate.length}`);
  console.log(`  ↳ matched by variant: ${variantMatches.length}`);
  console.log(`Unmatched sheet rows:   ${extras.length}`);
  console.log(`Sheet dup (same person): ${sheetDupGroups.length}`);
  console.log(`Roster missing email:   ${missingEmail.length}`);

  if (toAdd.length) {
    console.log(`\n── ADD (${toAdd.length}) ───────────────────────────────`);
    for (const r of toAdd) {
      console.log(
        `  + ${r.person.fullName}  [${r.person.roleType}, ${r.person.fellowshipCohortYear || "—"}, ${r.person.focusTags.join("/") || "—"}]`,
      );
    }
  }
  if (toUpdate.length) {
    console.log(`\n── FIX (${toUpdate.length}) ───────────────────────────────`);
    for (const u of toUpdate) {
      console.log(`  ~ ${u.record.person.fullName} (row ${u.record.rowNumber})`);
      for (const c of u.changes) console.log(`      ${c}`);
    }
  }
  if (variantMatches.length) {
    console.log(`\n── MATCHED BY VARIANT (${variantMatches.length}) — verify these are the same person ──`);
    for (const v of variantMatches) {
      console.log(`  ≈ roster "${v.roster}"  ↔  sheet "${v.sheet}" (row ${v.rowNumber})`);
    }
  }
  if (sheetDupGroups.length) {
    console.log(`\n── SAME ROSTER PERSON IN MULTIPLE SHEET ROWS (${sheetDupGroups.length}) — dedupe by hand ──`);
    for (const g of sheetDupGroups) {
      console.log(`  ! ${g.roster}: ${g.rows.join("  +  ")}`);
    }
  }
  if (extras.length) {
    console.log(`\n── UNMATCHED sheet rows NOT on roster (${extras.length}) — review by hand ──`);
    for (const r of extras) {
      console.log(`  ? ${r.person.fullName} [${r.person.roleType}, ${r.person.fellowshipCohortYear || "—"}] (row ${r.rowNumber})`);
    }
  }
  if (duplicates.length) {
    console.log(`\n── DUPLICATE names within roster file (${duplicates.length}) ──`);
    for (const d of duplicates) console.log(`  ! ${d.name}`);
  }
  if (missingEmail.length) {
    console.log(`\n── Roster people with NO email (${missingEmail.length}) ──`);
    for (const n of missingEmail) console.log(`  · ${n}`);
  }

  if (!apply) {
    console.log(`\n${line}\nDRY RUN — nothing written. Re-run with --apply to write.\n${line}\n`);
    return;
  }

  /* ── Apply (batched, upsert-only) ────────────────────────────────────── */
  const sheets = loaded.sheets;
  const spreadsheetId = getSpreadsheetId();
  const sheetName = loaded.sheetName;

  if (toUpdate.length) {
    const data = toUpdate.map((u) => ({
      range: `'${sheetName}'!A${u.record.rowNumber}:${PEOPLE_SHEET_WIDTH}${u.record.rowNumber}`,
      values: [personRecordToRow(u.record)],
    }));
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data },
    });
    console.log(`✓ Updated ${toUpdate.length} row(s).`);
  }

  if (toAdd.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${sheetName}'!A:${PEOPLE_SHEET_WIDTH}`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: toAdd.map((r) => personRecordToRow(r)) },
    });
    console.log(`✓ Added ${toAdd.length} new row(s).`);
  }

  console.log(`\n${line}\nDone.\n${line}\n`);
}

main().catch((error) => {
  console.error("Roster sync failed:", error?.message || error);
  process.exit(1);
});
