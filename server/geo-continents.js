"use strict";

/**
 * Lightweight country → continent map for atlas pin geography.
 * Keys are lowercase; unknown countries land in "Unknown".
 */

const CONTINENT_BY_COUNTRY = {
  // Europe
  germany: "Europe",
  deutschland: "Europe",
  france: "Europe",
  "united kingdom": "Europe",
  uk: "Europe",
  england: "Europe",
  scotland: "Europe",
  wales: "Europe",
  ireland: "Europe",
  netherlands: "Europe",
  holland: "Europe",
  belgium: "Europe",
  switzerland: "Europe",
  austria: "Europe",
  italy: "Europe",
  spain: "Europe",
  portugal: "Europe",
  sweden: "Europe",
  norway: "Europe",
  denmark: "Europe",
  finland: "Europe",
  poland: "Europe",
  "czech republic": "Europe",
  czechia: "Europe",
  hungary: "Europe",
  romania: "Europe",
  greece: "Europe",
  turkey: "Europe",
  türkiye: "Europe",
  ukraine: "Europe",
  estonia: "Europe",
  latvia: "Europe",
  lithuania: "Europe",
  slovenia: "Europe",
  croatia: "Europe",
  serbia: "Europe",
  slovakia: "Europe",
  bulgaria: "Europe",
  iceland: "Europe",
  luxembourg: "Europe",
  malta: "Europe",
  cyprus: "Europe",

  // North America
  "united states": "North America",
  "united states of america": "North America",
  usa: "North America",
  us: "North America",
  canada: "North America",
  mexico: "North America",

  // South America
  brazil: "South America",
  argentina: "South America",
  chile: "South America",
  colombia: "South America",
  peru: "South America",
  uruguay: "South America",
  ecuador: "South America",

  // Asia
  china: "Asia",
  japan: "Asia",
  india: "Asia",
  "south korea": "Asia",
  korea: "Asia",
  singapore: "Asia",
  taiwan: "Asia",
  "hong kong": "Asia",
  israel: "Asia",
  "united arab emirates": "Asia",
  uae: "Asia",
  indonesia: "Asia",
  thailand: "Asia",
  vietnam: "Asia",
  philippines: "Asia",
  malaysia: "Asia",
  pakistan: "Asia",
  bangladesh: "Asia",
  "saudi arabia": "Asia",

  // Oceania
  australia: "Oceania",
  "new zealand": "Oceania",

  // Africa
  "south africa": "Africa",
  nigeria: "Africa",
  kenya: "Africa",
  egypt: "Africa",
  morocco: "Africa",
  ghana: "Africa",
  ethiopia: "Africa",
  rwanda: "Africa",
};

function normalizeCountry(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Collapse common aliases so "USA" / "US" / "United States" count together. */
const DISPLAY_COUNTRY = {
  usa: "United States",
  us: "United States",
  "united states of america": "United States",
  "united states": "United States",
  uk: "United Kingdom",
  "united kingdom": "United Kingdom",
  england: "United Kingdom",
  deutschland: "Germany",
  germany: "Germany",
  holland: "Netherlands",
  netherlands: "Netherlands",
  türkiye: "Turkey",
  turkey: "Turkey",
  czechia: "Czech Republic",
  "czech republic": "Czech Republic",
};

function displayCountry(raw) {
  const key = normalizeCountry(raw);
  if (!key) return "";
  if (DISPLAY_COUNTRY[key]) return DISPLAY_COUNTRY[key];
  // Title-case fallback from the original casing when possible
  const trimmed = String(raw || "").trim();
  return trimmed || key;
}

function continentForCountry(country) {
  const key = normalizeCountry(country);
  if (!key) return "Unknown";
  return CONTINENT_BY_COUNTRY[key] || "Unknown";
}

/**
 * Aggregate pin locations from roster records.
 * @param {Array<{ person?: { currentCountry?: string, currentCity?: string } }>} records
 */
function buildGeographyStats(records) {
  const byCountry = new Map();
  const byContinent = new Map();
  let withCountry = 0;

  for (const record of records || []) {
    const raw = String(record?.person?.currentCountry || "").trim();
    if (!raw) continue;
    withCountry += 1;
    const country = displayCountry(raw);
    byCountry.set(country, (byCountry.get(country) || 0) + 1);
    const continent = continentForCountry(raw);
    byContinent.set(continent, (byContinent.get(continent) || 0) + 1);
  }

  const countries = [...byCountry.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 12);

  const continents = [...byContinent.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    withCountry,
    countries,
    continents,
  };
}

module.exports = {
  continentForCountry,
  buildGeographyStats,
};
