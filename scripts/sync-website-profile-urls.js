#!/usr/bin/env node
/**
 * Point Atlas profiles at confirmed foresight.org/people pages.
 *
 * Abigail Olvera is the model: profileUrl is
 * https://foresight.org/people/abigail-olvera/ and the profile shows a
 * Profile button. This script does the same for anyone else whose name
 * matches a live people-page, after the page title confirms the person.
 *
 * Existing personal websites are left alone. An empty profile URL, or the
 * generic https://foresight.org/about/ placeholder used for team, is filled.
 *
 * Usage:
 *   node scripts/sync-website-profile-urls.js           # dry run
 *   node scripts/sync-website-profile-urls.js --apply   # write RealData
 */

"use strict";

const path = require("path");
try {
  require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
  require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });
} catch (_) {}

const {
  loadRealDataRecords,
  assertRealDataHeaderOrder,
} = require("../server/realdata-store");
const { PEOPLE_HEADERS, getSpreadsheetId } = require("./sheet-schema");

const SITEMAPS = [
  "https://foresight.org/people-sitemap.xml",
  "https://foresight.org/people-sitemap2.xml",
];
const UA = "ForesightAtlas-Sync/1.0 (profile-urls)";
const ABOUT_URL = "https://foresight.org/about/";

/** Team we always report, even when a page cannot be confirmed. */
const TEAM_NAMES = [
  "Allison Duettmann",
  "Karolina Eklöw",
  "Boston Nyer",
  "Beatrice Erkers",
  "Lydia La Roux",
  "Amber Duettmann",
  "Lisa Stenvinkel",
  "Madeleine Parker",
  "Bradley Clark Royes",
  "Rachel Farley",
  "Martina Pepiciello",
  "Tara Padovan-Hickman",
  "Kristy Hilands",
  "Sherry Hull",
];

function columnLetter(index) {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function foldSlug(value) {
  return String(value || "")
    .split(/\r?\n/)[0]
    .replace(/\([^)]*\)/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nameForms(fullName) {
  const slug = foldSlug(fullName);
  const parts = slug.split("-").filter(Boolean);
  const forms = new Set();
  if (parts.length >= 2 && parts[0].length > 1) forms.add(parts.join("-"));
  if (parts.length >= 3 && parts[0].length > 1 && parts[parts.length - 1].length > 1) {
    forms.add(`${parts[0]}-${parts[parts.length - 1]}`);
    const kept = parts.filter((part, index) => part.length > 1 || index === 0 || index === parts.length - 1);
    if (kept.length >= 2 && kept[0].length > 1) forms.add(kept.join("-"));
  }
  return [...forms];
}

function peopleSlugFromUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.toLowerCase();
    if (host !== "foresight.org" && host !== "www.foresight.org") return "";
    const match = url.pathname.match(/^\/people\/([a-z0-9-]+)\/?$/i);
    return match ? match[1].toLowerCase() : "";
  } catch {
    return "";
  }
}

function isAboutPlaceholder(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  return raw === "https://foresight.org/about" || raw === "http://foresight.org/about";
}

async function loadPeoplePages() {
  const pages = new Map();
  for (const sitemapUrl of SITEMAPS) {
    const res = await fetch(sitemapUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`Sitemap ${sitemapUrl} returned ${res.status}`);
    const xml = await res.text();
    for (const match of xml.matchAll(/<loc>(https:\/\/foresight\.org\/people\/([a-z0-9-]+)\/)<\/loc>/gi)) {
      pages.set(match[2].toLowerCase(), match[1]);
    }
  }
  return pages;
}

function candidateSlugs(fullName, pages) {
  const hits = [];
  for (const form of nameForms(fullName)) {
    for (const suffix of ["", "-2", "-3"]) {
      const slug = `${form}${suffix}`;
      if (pages.has(slug) && !hits.includes(slug)) hits.push(slug);
    }
  }
  return hits;
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function pageTitle(html) {
  const og =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (og?.[1]) return decodeEntities(og[1]);
  const title = html.match(/<title>([^<]+)<\/title>/i);
  return title ? decodeEntities(title[1]) : "";
}

/** 0 = different person, 2 = first and last, 3 = full name. */
function titleScore(title, fullName) {
  const site = foldSlug(title)
    .replace(/-foresight-institute$/, "")
    .replace(/-people$/, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const full = foldSlug(fullName);
  if (!site || !full) return 0;
  if (site === full || site.startsWith(`${full}-`) || site.endsWith(`-${full}`) || site.includes(`-${full}-`)) {
    return 3;
  }
  const parts = full.split("-").filter((part) => part.length > 1);
  if (parts.length < 2) return 0;
  const first = parts[0];
  const last = parts[parts.length - 1];
  const siteParts = new Set(site.split("-").filter(Boolean));
  if (!siteParts.has(first) || !siteParts.has(last)) return 0;
  const allowed = new Set(full.split("-"));
  const extras = [...siteParts].filter((part) => !allowed.has(part) && part.length > 1);
  return extras.length === 0 ? 2 : 0;
}

async function mapPool(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return out;
}

async function confirmSlug(slug, url, fullName) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) return { slug, url, score: 0, title: "" };
  const title = pageTitle(await res.text());
  return { slug, url, score: titleScore(title, fullName), title };
}

function chooseConfirmed(results) {
  const good = results.filter((result) => result.score >= 2);
  if (good.length === 0) return null;
  good.sort((a, b) => b.score - a.score || a.slug.length - b.slug.length);
  if (good.length > 1 && good[0].score === good[1].score && good[0].slug.replace(/-\d+$/, "") !== good[1].slug.replace(/-\d+$/, "")) {
    return { ambiguous: good };
  }
  return { chosen: good[0] };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const pages = await loadPeoplePages();
  console.log(`Website people pages: ${pages.size}`);

  const loaded = await loadRealDataRecords({ write: apply });
  assertRealDataHeaderOrder(loaded.headerRow);

  const proposals = [];
  for (const record of loaded.records) {
    const name = String(record.person.fullName || "").split(/\r?\n/)[0].trim();
    if (!name) continue;
    const slugs = candidateSlugs(name, pages);
    if (slugs.length === 0) continue;
    proposals.push({ record, name, slugs });
  }

  console.log(`Name matches to confirm: ${proposals.length}`);
  const confirmed = await mapPool(proposals, 8, async (proposal) => {
    const results = [];
    for (const slug of proposal.slugs) {
      results.push(await confirmSlug(slug, pages.get(slug), proposal.name));
    }
    return { ...proposal, decision: chooseConfirmed(results), results };
  });

  const updates = [];
  const already = [];
  const keptOther = [];
  const ambiguous = [];
  const unmatchedTeam = [];

  const decidedById = new Map(confirmed.map((item) => [item.record.person.id, item]));

  for (const item of confirmed) {
    const decision = item.decision;
    if (!decision || decision.ambiguous) {
      if (decision?.ambiguous) {
        ambiguous.push(`${item.name} → ${decision.ambiguous.map((hit) => hit.slug).join(", ")}`);
      }
      continue;
    }
    const nextUrl = decision.chosen.url;
    const current = String(item.record.person.profileUrl || "").trim();
    const currentSlug = peopleSlugFromUrl(current);
    // A profile already pointing at a people page stays put, even if a
    // duplicate slug such as name-2 also matches.
    if (currentSlug) {
      already.push(item.name);
      continue;
    }
    if (current && !isAboutPlaceholder(current)) {
      keptOther.push(`${item.name} (kept ${current})`);
      continue;
    }
    updates.push({ record: item.record, name: item.name, url: nextUrl, previous: current || "(empty)" });
  }

  const teamKeys = new Set(TEAM_NAMES.map((name) => foldSlug(name)));
  for (const record of loaded.records) {
    const name = String(record.person.fullName || "").split(/\r?\n/)[0].trim();
    if (!teamKeys.has(foldSlug(name))) continue;
    const item = decidedById.get(record.person.id);
    const chosen = item?.decision?.chosen;
    if (!chosen) unmatchedTeam.push(name);
  }

  console.log(`\nAlready linked: ${already.length}`);
  console.log(`Will set: ${updates.length}`);
  console.log(`Kept a different website: ${keptOther.length}`);
  console.log(`Ambiguous, skipped: ${ambiguous.length}`);
  if (unmatchedTeam.length) console.log(`Team without a confirmed page: ${unmatchedTeam.join("; ")}`);
  else console.log("Team: every listed member has a confirmed page or an existing link.");

  console.log("\nUpdates:");
  for (const update of updates.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  ${update.name}  ${update.previous}  →  ${update.url}`);
  }
  if (ambiguous.length) {
    console.log("\nAmbiguous:");
    for (const line of ambiguous) console.log(`  ${line}`);
  }
  if (keptOther.length) {
    console.log("\nKept existing non-Foresight URLs:");
    for (const line of keptOther.sort()) console.log(`  ${line}`);
  }

  if (!apply) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply.");
    return;
  }

  if (updates.length === 0) {
    console.log("\nNothing to write.");
    return;
  }

  // Touch only the profileUrl cell. A full-row rewrite could shift a
  // password hash or blank a field the reader sanitizes on the way out.
  const profileIndex = PEOPLE_HEADERS.indexOf("profileUrl");
  if (profileIndex < 0) throw new Error("profileUrl is missing from the RealData schema.");
  const profileColumn = columnLetter(profileIndex);
  const data = updates.map((update) => ({
    range: `'${loaded.sheetName}'!${profileColumn}${update.record.rowNumber}`,
    values: [[update.url]],
  }));

  await loaded.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  const { invalidateSheetReadCache } = require("../server/sheet-read-cache");
  invalidateSheetReadCache();
  console.log(`\nWrote ${updates.length} profile URL(s).`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
