"use strict";

/**
 * Server-side geocoding helper for profile writes.
 *
 * The browser still does optimistic geocoding for map UX, but the backend owns
 * the canonical lat/lng persisted to RealData so profile saves stay consistent.
 * Tolerates common country typos (e.g. Germabny → Germany) and falls back to city-only.
 */

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const USER_AGENT = "ForesightMap/1.0 (directory profile sync)";

const COUNTRY_TYPO_MAP = {
  germabny: "Germany",
  germnay: "Germany",
  geramny: "Germany",
  gernany: "Germany",
  engalnd: "England",
  engand: "England",
  "untied kingdom": "United Kingdom",
  uk: "United Kingdom",
  usa: "United States",
  "untied states": "United States",
  americ: "United States",
  frnace: "France",
  spian: "Spain",
  itlay: "Italy",
  netherand: "Netherlands",
  austira: "Austria",
  switerland: "Switzerland",
  protugal: "Portugal",
  belguim: "Belgium",
  polnad: "Poland",
  czeck: "Czech Republic",
  jpan: "Japan",
  austrlia: "Australia",
  mexcio: "Mexico",
  singapor: "Singapore",
};

function correctCountryTypo(country) {
  if (!country || !String(country).trim()) return country;
  const key = String(country).trim().toLowerCase().replace(/\s+/g, " ");
  return COUNTRY_TYPO_MAP[key] ?? String(country).trim();
}

async function geocodeCityOneQuery(query, fallbackCity, fallbackCountry) {
  const url =
    `${NOMINATIM_BASE_URL}/search?format=json&limit=1&addressdetails=1&q=` +
    encodeURIComponent(query);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const first = Array.isArray(payload) ? payload[0] : null;
    if (!first) return null;
    const lat = Number.parseFloat(first.lat);
    const lng = Number.parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      city:
        first.address?.city ||
        first.address?.town ||
        first.address?.village ||
        fallbackCity ||
        "",
      country: first.address?.country || fallbackCountry || "",
    };
  } catch {
    return null;
  }
}

async function geocodeCity(cityName, country) {
  const city = String(cityName || "").trim();
  const rawCountry = String(country || "").trim();
  if (!city) return null;

  const correctedCountry = rawCountry ? correctCountryTypo(rawCountry) : "";
  const queries = [];
  if (correctedCountry) queries.push(`${city}, ${correctedCountry}`);
  if (rawCountry && correctedCountry !== rawCountry) queries.push(`${city}, ${rawCountry}`);
  queries.push(city);

  for (let i = 0; i < queries.length; i++) {
    const result = await geocodeCityOneQuery(queries[i], city, correctedCountry || rawCountry);
    if (result) return result;
    if (i < queries.length - 1) {
      await new Promise((r) => setTimeout(r, 1100));
    }
  }
  return null;
}

module.exports = {
  geocodeCity,
};
