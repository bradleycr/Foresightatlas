"use strict";

/**
 * Server-side geocoding helper for profile writes.
 *
 * The browser still does optimistic geocoding for map UX, but the backend owns
 * the canonical lat/lng persisted to RealData so profile saves stay consistent.
 */

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const USER_AGENT = "ForesightMap/1.0 (directory profile sync)";

async function geocodeCity(cityName, country) {
  const city = String(cityName || "").trim();
  const countryName = String(country || "").trim();
  if (!city) return null;

  const query = countryName ? `${city}, ${countryName}` : city;
  const url =
    `${NOMINATIM_BASE_URL}/search?format=json&limit=1&addressdetails=1&q=` +
    encodeURIComponent(query);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed with ${response.status}`);
    }

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
        city,
      country: first.address?.country || countryName || "",
    };
  } catch (error) {
    console.warn("Server geocoding failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

module.exports = {
  geocodeCity,
};
