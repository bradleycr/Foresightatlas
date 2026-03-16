#!/usr/bin/env node
/**
 * Sync fellows from the Foresight website into the Google Sheet (RealData tab).
 *
 * 1. Appends new fellows (from FELLOWS_TO_ADD or --from-file=website-fellows.json) to RealData.
 * 2. Fetches each fellow's bio and profile image URL (og:image) from foresight.org/people/{slug}/
 *    and writes expandedProjectDescription and profileImageUrl. Images stay hosted on foresight.org.
 *
 * Requires write access: GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Usage:
 *   pnpm run sync:fellows
 *   pnpm run sync:fellows -- --from-file=website-fellows.json   # use scraped list (all years)
 *   pnpm run sync:fellows -- --bios-only   # only update bios + images for existing Fellow rows
 *   pnpm run sync:fellows -- --add-only    # only append new fellows (no bios/images)
 */

"use strict";

const path = require("path");
const fs = require("fs");
try {
  require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
  require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });
} catch (_) {}

const {
  getSheetsClient,
  loadRealDataRecords,
  upsertRealDataRecord,
  buildStablePersonId,
  normalizeName,
} = require("../server/realdata-store.js");

/** Fellows we know are on the website (2026) but may be missing from the sheet. */
const FELLOWS_TO_ADD = [
  "Abigail Olvera",
  "Alberto Privitera",
  "Alex Plesa",
  "Avery Krieger",
  "Constanze Albrecht",
  "Donnacha Fitzgerald",
  "Elisa Kallioniemi",
  "Fin Moorhouse",
  "Gianluca Cidonio",
  "Huixin Zhan",
  "Jakub Lála",
  "Kathryn Shelley",
  "Keith Patarroyo",
  "Konlin Shen",
  "Léo Pio-Lopez",
  "Mahlaqua Mila Noor",
  "Mateo Petel",
  "Max Kanwal",
];

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const UA = "ForesightMap-Sync/1.0 (sync-fellows-from-website)";

/** Reject bios that are boolean, menu text, or breadcrumb-only. */
function isValidBio(s) {
  if (!s || typeof s !== "string") return false;
  const t = s.trim();
  if (t.length < 20) return false;
  const lower = t.toLowerCase();
  if (lower === "true" || lower === "false") return false;
  if (/^People\s*\/\s*\S+$/i.test(t)) return false;
  if (/^Menu\s|^Focus Areas\s|Secure AI Neurotechnology Longevity/i.test(t)) return false;
  return true;
}

/** Only treat as image URL if it looks like http(s) and foresight.org or image extension. */
function isValidProfileImageUrl(s) {
  if (!s || typeof s !== "string") return false;
  const t = s.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  if (/@/.test(t)) return false;
  return /foresight\.org/i.test(t) || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(t);
}

/**
 * Fetch a fellow's profile page and return { bio, profileImageUrl }.
 * profileImageUrl is the og:image URL (hosted on foresight.org; we do not host it).
 */
async function fetchProfilePage(slug) {
  if (!slug) return { bio: null, profileImageUrl: null };
  const url = `https://foresight.org/people/${slug}/`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return { bio: null, profileImageUrl: null };
    const text = await res.text();

    let bio = null;
    // Prefer og:description (Yoast/WordPress) — real bio, may be truncated with [&hellip;]
    const ogDesc = text.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    ) || text.match(/content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    if (ogDesc && ogDesc[1]) {
      const b = ogDesc[1]
        .replace(/\s*\[&hellip;\]\s*$/, "…")
        .replace(/&hellip;/g, "…")
        .replace(/&amp;/g, "&")
        .replace(/&#8217;/g, "'")
        .trim();
      if (b.length > 30 && !/^People\s*\/\s*\S+$/i.test(b)) bio = b;
    }
    if (!bio) {
      const markdownMatch = text.match(
        /People\s*\/\s*[^\n]+\n\n([\s\S]+?)(?=\n##\s|\n\[Donate\]|$)/i
      );
      if (markdownMatch) {
        const b = markdownMatch[1].replace(/\n+/g, " ").trim();
        if (b.length > 20 && !/^People\s*\/\s*\S+$/i.test(b)) bio = b;
      }
    }
    if (!bio) {
      const metaDesc = text.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
      if (metaDesc && metaDesc[1].length > 30) {
        const b = metaDesc[1].trim();
        if (!/^People\s*\/\s*\S+$/i.test(b)) bio = b;
      }
    }
    if (!bio) {
      const afterBreadcrumb = text.replace(/[\s\S]*?People\s*\/\s*[^<]+/i, "");
      const pMatch = afterBreadcrumb.match(/<p[^>]*>([\s\S]+?)<\/p>/i);
      if (pMatch) {
        const b = pMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (b.length > 30 && !/^People\s*\/\s*\S+$/i.test(b)) bio = b;
      }
    }

    let profileImageUrl = null;
    const ogImage = text.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    ) || text.match(/content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogImage && ogImage[1]) profileImageUrl = ogImage[1].trim();

    return { bio, profileImageUrl };
  } catch (err) {
    console.warn(`  Fetch failed for ${url}:`, err.message);
    return { bio: null, profileImageUrl: null };
  }
}

async function fetchBioFromProfile(fullName) {
  const slug = slugify(fullName);
  const { bio } = await fetchProfilePage(slug);
  return bio;
}

function buildMinimalPerson(fullName, cohortYear = 2026, roleType = "Fellow", slug = null) {
  const s = slug || slugify(fullName);
  const person = {
    fullName,
    roleType: roleType === "Senior Fellow" ? "Senior Fellow" : "Fellow",
    fellowshipCohortYear: cohortYear,
    fellowshipEndYear: null,
    affiliationOrInstitution: null,
    focusTags: [],
    currentCity: "",
    currentCountry: "",
    currentCoordinates: { lat: 0, lng: 0 },
    primaryNode: "Global",
    profileUrl: `https://foresight.org/people/${s}/`,
    profileImageUrl: null,
    contactUrlOrHandle: null,
    shortProjectTagline: "",
    expandedProjectDescription: "",
    isAlumni: false,
  };
  person.id = buildStablePersonId(person, 0);
  return person;
}

async function main() {
  const biosOnly = process.argv.includes("--bios-only");
  const addOnly = process.argv.includes("--add-only");
  const fromFileArg = process.argv.find((a) => a.startsWith("--from-file="));
  const fromFilePath = fromFileArg ? fromFileArg.split("=")[1] : null;

  let fellowsToAdd = FELLOWS_TO_ADD.map((fullName) => ({ fullName, year: 2026, type: "Fellow", slug: null }));
  if (fromFilePath) {
    const abs = path.isAbsolute(fromFilePath) ? fromFilePath : path.resolve(process.cwd(), fromFilePath);
    if (!fs.existsSync(abs)) {
      console.error("File not found:", abs);
      process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(abs, "utf8"));
    const raw = Array.isArray(data)
      ? data.map((e) => ({
          fullName: e.fullName || e.name,
          year: e.year || 2026,
          type: e.type || "Fellow",
          slug: e.slug || null,
        }))
      : fellowsToAdd;
    // Dedupe by normalized name: keep one entry per person (prefer Senior, then max year)
    const byName = new Map();
    for (const e of raw) {
      const key = normalizeName(e.fullName);
      const existing = byName.get(key);
      if (!existing || e.type === "Senior Fellow" || (e.type === existing.type && e.year > existing.year)) {
        byName.set(key, e);
      }
    }
    fellowsToAdd = Array.from(byName.values());
    console.log(`Loaded ${fellowsToAdd.length} unique fellows from ${fromFilePath}`);
  }

  const sheets = await getSheetsClient({ write: true });
  if (!sheets) {
    console.error(
      "Google Sheets write credentials required. Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS."
    );
    process.exit(1);
  }

  const loaded = await loadRealDataRecords({ sheets, write: true });
  const existingNames = new Set(
    loaded.records.map((r) => normalizeName(r.person.fullName))
  );

  // Step 1: Append new fellows (unless --bios-only)
  if (!biosOnly) {
    let added = 0;
    for (const entry of fellowsToAdd) {
      const { fullName, year, type, slug } = entry;
      if (existingNames.has(normalizeName(fullName))) continue;
      const person = buildMinimalPerson(fullName, year, type, slug);
      const record = { person, auth: {} };
      await upsertRealDataRecord(loaded.sheets, loaded.sheetName, record);
      existingNames.add(normalizeName(fullName));
      added++;
      console.log(`  Added: ${fullName} (${year})`);
    }
    if (added > 0) {
      console.log(`Added ${added} new fellow(s) to ${loaded.sheetName}.`);
      Object.assign(loaded, await loadRealDataRecords({ sheets: loaded.sheets, write: true }));
    }
  }

  if (addOnly) {
    console.log("Done (--add-only: skipping bio/image fetch).");
    return;
  }

  // Step 2: Fetch bios and profile images; update sheet
  const fellowsToUpdate =
    biosOnly
      ? loaded.records.filter(
          (r) =>
            r.person.roleType === "Fellow" || r.person.roleType === "Senior Fellow"
        )
      : loaded.records.filter((r) => {
          const name = normalizeName(r.person.fullName);
          const inList = fellowsToAdd.some((e) => normalizeName(e.fullName) === name);
          const needsBio = !(r.person.expandedProjectDescription || "").trim();
          const needsImage = !(r.person.profileImageUrl || "").trim();
          return (
            (r.person.roleType === "Fellow" || r.person.roleType === "Senior Fellow") &&
            (inList || needsBio || needsImage)
          );
        });

  console.log(
    `Fetching bios and profile images for ${fellowsToUpdate.length} fellow(s) from foresight.org/people/…`
  );
  let updated = 0;
  for (const record of fellowsToUpdate) {
    const { person } = record;
    const slug = person.profileUrl?.match(/\/people\/([^/]+)/)?.[1] || slugify(person.fullName);
    const { bio, profileImageUrl } = await fetchProfilePage(slug);
    const trimmedBio = bio && isValidBio(bio) ? bio.slice(0, 50000).trim() : "";
    const imageUrl = profileImageUrl && isValidProfileImageUrl(profileImageUrl) ? profileImageUrl : null;
    const hasChange =
      (trimmedBio && trimmedBio !== (person.expandedProjectDescription || "").trim()) ||
      (imageUrl && imageUrl !== (person.profileImageUrl || "").trim());
    if (!hasChange) continue;
    const updatedRecord = {
      ...record,
      person: {
        ...person,
        expandedProjectDescription: trimmedBio || person.expandedProjectDescription || "",
        profileImageUrl: imageUrl || person.profileImageUrl || null,
      },
    };
    await upsertRealDataRecord(loaded.sheets, loaded.sheetName, updatedRecord);
    updated++;
    console.log(`  Updated: ${person.fullName}${profileImageUrl ? " (incl. image)" : ""}`);
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`Done. ${updated} bio/image(s) written to ${loaded.sheetName}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
