/**
 * Geocoding Service
 *
 * Provides utilities for geocoding city names to coordinates and countries.
 * Uses OpenStreetMap Nominatim API (free, no API key required).
 * Tolerates common country typos (e.g. Germabny → Germany) and falls back to city-only search.
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  country?: string;
  city?: string;
}

export interface GeocodeCityOptions {
  /**
   * Abort signal for caller-driven cancellation (e.g. user keeps typing).
   * When aborted, geocoding returns null without logging noisy errors.
   */
  signal?: AbortSignal;
  /**
   * Cache TTL in ms for identical queries. Defaults to 10 minutes.
   * This is purely a UI/perf cache; it does not persist across reloads.
   */
  cacheTtlMs?: number;
}

/** Common country name typos → canonical name for geocoding. */
const COUNTRY_TYPO_MAP: Record<string, string> = {
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

function correctCountryTypo(country: string): string {
  if (!country.trim()) return country;
  const key = country.trim().toLowerCase().replace(/\s+/g, " ");
  return COUNTRY_TYPO_MAP[key] ?? country.trim();
}

/**
 * Common city shorthand users type into the profile form.
 * Keep this small and high-signal; it is only meant to prevent the “why didn’t
 * this resolve?” footguns for popular abbreviations.
 */
const CITY_ALIAS_MAP: Record<string, { city: string; countryHint?: string }> = {
  sf: { city: "San Francisco", countryHint: "United States" },
  "san fran": { city: "San Francisco", countryHint: "United States" },
  "bay area": { city: "San Francisco", countryHint: "United States" },
  la: { city: "Los Angeles", countryHint: "United States" },
  nyc: { city: "New York", countryHint: "United States" },
  "new york city": { city: "New York", countryHint: "United States" },
  dc: { city: "Washington, DC", countryHint: "United States" },
  "washington dc": { city: "Washington, DC", countryHint: "United States" },
};

function applyCityAlias(rawCity: string, rawCountry: string): { city: string; country: string } {
  const key = rawCity.trim().toLowerCase().replace(/\s+/g, " ");
  const alias = CITY_ALIAS_MAP[key];
  if (!alias) return { city: rawCity.trim(), country: rawCountry.trim() };
  return {
    city: alias.city,
    country: rawCountry.trim() || alias.countryHint || "",
  };
}

/**
 * Normalize city names for comparison (lowercase, remove common suffixes)
 */
function normalizeCityName(city: string): string {
  return city
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^the\s+/i, '')
    .replace(/\s+city$/i, '')
    .replace(/\s+town$/i, '');
}

/**
 * Check if two city names are similar (fuzzy matching)
 */
function areCitiesSimilar(city1: string, city2: string): boolean {
  const norm1 = normalizeCityName(city1);
  const norm2 = normalizeCityName(city2);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // One contains the other (e.g., "San Francisco" contains "San Francisco")
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  
  // Check for common variations (e.g., "SF" = "San Francisco", "NYC" = "New York")
  const commonVariations: Record<string, string[]> = {
    'san francisco': ['sf', 'san fran', 'bay area'],
    'new york': ['nyc', 'new york city'],
    'los angeles': ['la', 'los ang'],
    'washington': ['dc', 'washington dc'],
    'bangalore': ['bengaluru'],
    'mumbai': ['bombay'],
  };
  
  for (const [canonical, variations] of Object.entries(commonVariations)) {
    if ((norm1 === canonical || variations.includes(norm1)) &&
        (norm2 === canonical || variations.includes(norm2))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validate coordinates are reasonable (not obviously wrong)
 */
function areCoordinatesValid(lat: number, lng: number): boolean {
  // Check if coordinates are within valid ranges
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  // Check if coordinates are not exactly zero (which usually means unset)
  if (lat === 0 && lng === 0) return false;
  // Check if coordinates are not obviously wrong (e.g., both are very small)
  if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) return false;
  return true;
}

/**
 * Validate reverse geocoding result against expected city/country
 * Returns true if the result seems reasonable, false if it's likely wrong
 */
export function validateReverseGeocodeResult(
  geocoded: { city: string; country: string },
  expectedCity?: string,
  expectedCountry?: string
): { isValid: boolean; reason?: string } {
  // If no expected values, assume valid (can't validate)
  if (!expectedCity && !expectedCountry) {
    return { isValid: true };
  }
  
  // Check country match first (more reliable)
  if (expectedCountry) {
    const normExpected = normalizeCityName(expectedCountry);
    const normGeocoded = normalizeCityName(geocoded.country);
    
    if (normExpected !== normGeocoded && !normGeocoded.includes(normExpected) && !normExpected.includes(normGeocoded)) {
      // Check for common country name variations
      const countryVariations: Record<string, string[]> = {
        'usa': ['united states', 'united states of america', 'us'],
        'uk': ['united kingdom', 'great britain', 'britain'],
        'uae': ['united arab emirates'],
      };
      
      let matches = false;
      for (const [canonical, variations] of Object.entries(countryVariations)) {
        if ((normExpected === canonical || variations.includes(normExpected)) &&
            (normGeocoded === canonical || variations.includes(normGeocoded))) {
          matches = true;
          break;
        }
      }
      
      if (!matches) {
        return {
          isValid: false,
          reason: `Country mismatch: expected "${expectedCountry}", got "${geocoded.country}"`
        };
      }
    }
  }
  
  // Check city match
  if (expectedCity) {
    if (!areCitiesSimilar(geocoded.city, expectedCity)) {
      return {
        isValid: false,
        reason: `City mismatch: expected "${expectedCity}", got "${geocoded.city}"`
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Single-query Nominatim search. Returns null on no results or error.
 */
async function geocodeCityOneQuery(
  query: string,
  options?: { signal?: AbortSignal },
): Promise<GeocodeResult | null> {
  try {
    if (options?.signal?.aborted) return null;
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`,
      {
        headers: {
          "User-Agent": "ForesightAtlas/1.0", // Required by Nominatim
        },
        signal: options?.signal,
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data && data.length > 0) {
      const result = data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        country: result.address?.country || undefined,
        city: result.address?.city || result.address?.town || result.address?.village || undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/* ── Lightweight in-memory cache + rate limiting ───────────────────── */

type CacheEntry = { value: GeocodeResult | null; expiresAt: number };
const geocodeCache = new Map<string, CacheEntry>();

/**
 * Nominatim politely asks clients to keep to ~1 request/second.
 * We serialize requests through a tiny scheduler so typing-driven UI does
 * not accidentally burst and get intermittent 429s.
 */
let nominatimChain: Promise<void> = Promise.resolve();
let nextNominatimAtMs = 0;
const NOMINATIM_MIN_INTERVAL_MS = 1100;

async function scheduleNominatimSlot(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return;
  const startAfter = Math.max(nextNominatimAtMs, Date.now());
  nextNominatimAtMs = startAfter + NOMINATIM_MIN_INTERVAL_MS;
  const waitMs = startAfter - Date.now();
  if (waitMs <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(resolve, waitMs);
    if (!signal) return;
    const onAbort = () => {
      window.clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  }).catch((e) => {
    if (e?.name === "AbortError") return;
    throw e;
  });
}

async function nominatimGeocode(query: string, options?: { signal?: AbortSignal }): Promise<GeocodeResult | null> {
  const signal = options?.signal;
  if (signal?.aborted) return null;

  // Ensure requests run sequentially with spacing.
  const run = async () => {
    await scheduleNominatimSlot(signal);
    if (signal?.aborted) return null;
    return geocodeCityOneQuery(query, { signal });
  };

  const p = nominatimChain.then(run, run) as unknown as Promise<GeocodeResult | null>;
  // Keep chain alive even if a request fails/aborts.
  nominatimChain = p.then(() => undefined, () => undefined);
  return p;
}

/**
 * Geocode a city name to get coordinates and country.
 * Tries: (1) "city, corrected country" (fixes common typos like Germabny→Germany),
 * (2) "city, country" as typed, (3) city-only so well-known cities still resolve.
 */
export async function geocodeCity(
  cityName: string,
  country?: string,
  options?: GeocodeCityOptions,
): Promise<GeocodeResult | null> {
  if (!cityName.trim()) return null;

  const aliased = applyCityAlias(cityName, country ?? "");
  const city = aliased.city;
  const rawCountry = aliased.country;
  const correctedCountry = rawCountry ? correctCountryTypo(rawCountry) : "";
  const ttl = typeof options?.cacheTtlMs === "number" ? options.cacheTtlMs : 10 * 60 * 1000;
  const signal = options?.signal;
  if (signal?.aborted) return null;

  // Build query list: prefer corrected country, then city-only for fallback
  const queries: string[] = [];
  if (correctedCountry) {
    queries.push(`${city}, ${correctedCountry}`);
  }
  if (rawCountry && correctedCountry !== rawCountry) {
    queries.push(`${city}, ${rawCountry}`);
  }
  queries.push(city);

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const cached = geocodeCache.get(q);
    if (cached && cached.expiresAt > Date.now()) {
      if (cached.value) return cached.value;
      continue;
    }

    const result = await nominatimGeocode(q, { signal });
    if (result) return result;

    geocodeCache.set(q, { value: null, expiresAt: Date.now() + Math.min(ttl, 60_000) });
  }

  return null;
}

/**
 * Geocode just the country from a city name
 */
export async function geocodeCountry(cityName: string): Promise<string | null> {
  const result = await geocodeCity(cityName);
  return result?.country || null;
}

/**
 * Reverse geocode coordinates to get city and country name
 * @param lat Latitude
 * @param lng Longitude
 * @param expectedCity Optional: expected city name for validation
 * @param expectedCountry Optional: expected country name for validation
 * @returns City and country, or null if geocoding fails or result is invalid
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  expectedCity?: string,
  expectedCountry?: string
): Promise<{ city: string; country: string } | null> {
  // Validate coordinates first
  if (!areCoordinatesValid(lat, lng)) {
    console.warn(`Invalid coordinates: ${lat}, ${lng}`);
    return null;
  }

  try {
    // Use zoom=18 for more detailed results (city level)
    // Also try with different zoom levels if first attempt fails
    const zoomLevels = [18, 10, 5];
    
    for (const zoom of zoomLevels) {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${zoom}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'ForesightAtlas/1.0', // Required by Nominatim
          },
        }
      );
      
      if (!response.ok) {
        if (zoom === zoomLevels[zoomLevels.length - 1]) {
          // Last attempt failed
          console.warn(`Reverse geocoding failed for ${lat}, ${lng}: ${response.statusText}`);
        }
        continue; // Try next zoom level
      }
      
      const data = await response.json();
      
      if (data && data.address) {
        // Try multiple fields in order of preference
        const city = data.address.city 
          || data.address.town 
          || data.address.village 
          || data.address.municipality 
          || data.address.county 
          || data.address.state_district
          || data.address.state
          || "";
        const country = data.address.country || "";
        
        if (city && country) {
          const result = { city, country };
          
          // Validate result if expected values provided
          if (expectedCity || expectedCountry) {
            const validation = validateReverseGeocodeResult(result, expectedCity, expectedCountry);
            if (!validation.isValid) {
              console.warn(`Reverse geocode validation failed for ${lat}, ${lng}: ${validation.reason}`);
              // If validation fails, try next zoom level or return null
              if (zoom === zoomLevels[zoomLevels.length - 1]) {
                // Last attempt, return null even if invalid (caller can use fallback)
                return null;
              }
              continue; // Try next zoom level
            }
          }
          
          // Log successful geocoding
          if (expectedCity || expectedCountry) {
            console.log(`✓ Reverse geocoded ${lat}, ${lng} -> ${city}, ${country} (validated)`);
          } else {
            console.log(`Reverse geocoded ${lat}, ${lng} -> ${city}, ${country}`);
          }
          
          return result;
        }
      }
      
      // If we got here, this zoom level didn't work, try next
      if (zoom === zoomLevels[zoomLevels.length - 1]) {
        console.warn(`Reverse geocoding incomplete for ${lat}, ${lng} after trying all zoom levels`);
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error reverse geocoding ${lat}, ${lng}:`, error);
    return null;
  }
}