"use strict";

/**
 * Server-side geocoding helper for profile writes.
 *
 * The browser still does optimistic geocoding for map UX, but the backend owns
 * the canonical lat/lng persisted to RealData so profile saves stay consistent.
 * Tolerates common country typos (e.g. Germabny → Germany) and falls back to city-only.
 */

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const USER_AGENT = "ForesightAtlas/1.0 (directory profile sync)";

const COUNTRY_TYPO_MAP = {
  germabny: "Germany",
  germnay: "Germany",
  geramny: "Germany",
  gernany: "Germany",
  german: "Germany",
  deutschland: "Germany",
  ger: "Germany",
  de: "Germany",
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

const KNOWN_LOCATIONS = {
  "berlin|germany": {
    lat: 52.520008,
    lng: 13.404954,
    city: "Berlin",
    country: "Germany",
  },
  "san francisco|united states": {
    lat: 37.774929,
    lng: -122.419416,
    city: "San Francisco",
    country: "United States",
  },
};

function normalizeCityName(city) {
  return String(city || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^the\s+/i, "")
    .replace(/\s+city$/i, "");
}

function correctCountryTypo(country) {
  if (!country || !String(country).trim()) return country;
  const key = String(country).trim().toLowerCase().replace(/\s+/g, " ");
  return COUNTRY_TYPO_MAP[key] ?? String(country).trim();
}

function lookupKnownLocation(city, country) {
  const cityNorm = normalizeCityName(city);
  const countryNorm = correctCountryTypo(country).trim().toLowerCase();

  if (cityNorm === "berlin") {
    if (!countryNorm || ["germany", "german", "deutschland", "de", "ger"].includes(countryNorm)) {
      return KNOWN_LOCATIONS["berlin|germany"];
    }
  }

  if (!countryNorm) return null;
  return KNOWN_LOCATIONS[`${cityNorm}|${countryNorm}`] ?? null;
}

async function geocodeCityOneQuery(query, fallbackCity, fallbackCountry, structured) {
  const params = new URLSearchParams({
    format: "json",
    limit: "1",
    addressdetails: "1",
  });

  if (structured) {
    params.set("city", structured.city);
    params.set("country", structured.country);
  } else {
    params.set("q", query);
  }

  const url = `${NOMINATIM_BASE_URL}/search?${params.toString()}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (response.status === 429 || !response.ok) return null;
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
  const known = lookupKnownLocation(city, correctedCountry || rawCountry);
  if (known) return known;

  if (correctedCountry) {
    const structured = await geocodeCityOneQuery(
      `${city}, ${correctedCountry}`,
      city,
      correctedCountry,
      { city, country: correctedCountry },
    );
    if (structured) return structured;
    await new Promise((r) => setTimeout(r, 1100));
  }

  const queries = [];
  if (correctedCountry) queries.push(`${city}, ${correctedCountry}`);
  if (rawCountry && correctedCountry !== rawCountry) queries.push(`${city}, ${rawCountry}`);
  queries.push(city);

  for (let i = 0; i < queries.length; i++) {
    const result = await geocodeCityOneQuery(
      queries[i],
      city,
      correctedCountry || rawCountry,
      null,
    );
    if (result) return result;
    if (i < queries.length - 1) {
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  return lookupKnownLocation(city, correctedCountry || rawCountry);
}

module.exports = {
  geocodeCity,
};
