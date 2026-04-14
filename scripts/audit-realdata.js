#!/usr/bin/env node

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs").promises;
const path = require("path");
const {
  loadRealDataRecords,
  normalizeName,
  scorePersonRichness,
} = require("../server/realdata-store");

function bucketBy(items, getKey) {
  const buckets = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    const bucket = buckets.get(key) || [];
    bucket.push(item);
    buckets.set(key, bucket);
  });
  return buckets;
}

async function main() {
  const { records, sheetName } = await loadRealDataRecords();

  const duplicateNameBuckets = [...bucketBy(records, (record) => normalizeName(record.person.fullName)).entries()]
    .filter(([name, bucket]) => name && bucket.length > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  const blankIdRecords = records.filter((record) => !String(record.person.id || "").trim());
  const blankCityRecords = records.filter((record) => !String(record.person.currentCity || "").trim());
  const blankCountryRecords = records.filter((record) => !String(record.person.currentCountry || "").trim());
  const zeroCoordinateRecords = records.filter((record) => {
    const coords = record.person.currentCoordinates || { lat: 0, lng: 0 };
    return coords.lat === 0 && coords.lng === 0;
  });
  const mustChangePasswordRecords = records.filter((record) => record.auth.mustChangePassword);
  const claimedRecords = records.filter((record) => !!record.auth.claimedAt);

  const topDuplicates = duplicateNameBuckets.slice(0, 20).map(([name, bucket]) => {
    const ranked = [...bucket].sort(
      (left, right) => scorePersonRichness(right.person) - scorePersonRichness(left.person),
    );
    return [
      `### ${bucket.length} rows for ${ranked[0].person.fullName}`,
      "",
      ...ranked.map((record) => {
        const coords = record.person.currentCoordinates || { lat: 0, lng: 0 };
        return [
          `- Row ${record.rowNumber}`,
          `  - id: \`${record.person.id || "(blank)"}\``,
          `  - role/year: ${record.person.roleType} / ${record.person.fellowshipCohortYear || "(blank)"}`,
          `  - city/country: ${record.person.currentCity || "(blank)"} / ${record.person.currentCountry || "(blank)"}`,
          `  - coords: ${coords.lat}, ${coords.lng}`,
          `  - richness score: ${scorePersonRichness(record.person)}`,
          `  - password hash present: ${record.auth.passwordHash ? "yes" : "no"}`,
          `  - claimedAt: ${record.auth.claimedAt || "(blank)"}`,
        ].join("\n");
      }),
      "",
    ].join("\n");
  });

  const lines = [
    "# RealData audit report",
    "",
    `- Sheet tab audited: \`${sheetName}\``,
    `- Total person rows: **${records.length}**`,
    `- Duplicate normalized full names: **${duplicateNameBuckets.length}**`,
    `- Rows missing explicit IDs: **${blankIdRecords.length}**`,
    `- Rows missing current city: **${blankCityRecords.length}**`,
    `- Rows missing current country: **${blankCountryRecords.length}**`,
    `- Rows with zero coordinates: **${zeroCoordinateRecords.length}**`,
    `- Rows that still require password change: **${mustChangePasswordRecords.length}**`,
    `- Rows already claimed: **${claimedRecords.length}**`,
    "",
    "## Canonical duplicate resolution rules",
    "",
    "1. Keep one canonical row per normalized full name unless a true same-name collision is confirmed.",
    "2. Prefer the row with the richest profile data: city/country, coordinates, focus tags, project text, and links.",
    "3. Prefer rows that already have a password hash or claim timestamp when richness is otherwise comparable.",
    "4. Preserve the canonical row's `id` and merge non-conflicting data from weaker duplicates into it.",
    "5. Archive or delete the leftover duplicate rows only after the canonical row is complete.",
    "",
    "## Highest-priority duplicate groups",
    "",
    ...(topDuplicates.length > 0 ? topDuplicates : ["No duplicate names detected.", ""]),
  ];

  const reportsDir = path.join(__dirname, "../reports");
  await fs.mkdir(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, "REALDATA_AUDIT_REPORT.md");
  await fs.writeFile(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
