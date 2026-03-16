#!/usr/bin/env node
/**
 * Scrape all fellows from https://foresight.org/engage/fellowship/ by year (2017–2026)
 * and Regular/Senior type. Writes website-fellows.json for use with sync:fellows --from-file.
 *
 * Run once: pnpm run scrape:fellowship
 * Then:     GOOGLE_SERVICE_ACCOUNT_KEY='...' pnpm run sync:fellows -- --from-file=website-fellows.json
 *
 * Requires: pnpm add -D @playwright/test && npx playwright install chromium
 */

"use strict";

const fs = require("fs");
const path = require("path");

const OUT_FILE = path.resolve(__dirname, "website-fellows.json");
const FELLOWSHIP_URL = "https://foresight.org/engage/fellowship/";

async function main() {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(FELLOWSHIP_URL, { waitUntil: "networkidle", timeout: 30000 });

  const byKey = new Map(); // key = normalized name + year + type

  const years = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];
  const types = ["Regular", "Senior"];

  for (const year of years) {
    const yearButton = page.getByRole("button", { name: new RegExp(`filter results by ${year} term`, "i") });
    await yearButton.click();
    await page.waitForTimeout(800);

    for (const type of types) {
      const typeButton = page.getByRole("button", { name: new RegExp(`filter results by ${type} term`, "i") });
      await typeButton.click();
      await page.waitForTimeout(800);

      let pageNum = 1;
      for (;;) {
        const headings = await page.locator("h2, h3").allTextContents();
        const fellowStart = headings.findIndex((h) => /^Fellows$/i.test(String(h).trim()));
        const fellowEnd = headings.findIndex((h) => /Fellow Seminars/i.test(String(h)));
        const nameHeadings =
          fellowStart >= 0 && fellowEnd > fellowStart
            ? headings.slice(fellowStart + 1, fellowEnd)
            : [];

        const profileLinks = await page.locator('a[href*="/people/"]').evaluateAll((nodes) =>
          nodes.map((a) => {
            const href = a.getAttribute("href") || "";
            const match = href.match(/\/people\/([^/]+)\/?/);
            return match ? { slug: match[1] } : null;
          }).filter(Boolean)
        );

        const names = nameHeadings.filter(
          (n) => n && String(n).trim().length > 0 && !/Fellow Seminars|Mentors|Career Counseling/.test(String(n))
        );
        for (let i = 0; i < names.length; i++) {
          const fullName = String(names[i]).trim();
          const slug = profileLinks[i]?.slug || slugFromName(fullName);
          const key = `${fullName.toLowerCase().replace(/\s+/g, " ")}|${year}|${type}`;
          if (!byKey.has(key)) {
            byKey.set(key, { fullName, year, type: type === "Senior" ? "Senior Fellow" : "Fellow", slug });
          }
        }

        const nextBtn = page.getByRole("button", { name: "go to next page" });
        const disabled = await nextBtn.isDisabled().catch(() => true);
        if (disabled || names.length === 0 || pageNum >= 25) break;
        await nextBtn.click();
        await page.waitForTimeout(600);
        pageNum++;
      }
    }
  }

  await browser.close();

  const list = Array.from(byKey.values()).sort((a, b) => b.year - a.year || a.fullName.localeCompare(b.fullName));
  fs.writeFileSync(OUT_FILE, JSON.stringify(list, null, 2), "utf8");
  console.log(`Wrote ${list.length} fellows to ${OUT_FILE}`);
}

function slugFromName(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
