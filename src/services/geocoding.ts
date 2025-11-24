/**
 * Geocoding Service
 * 
 * Provides utilities for geocoding city names to coordinates and countries.
 * Uses OpenStreetMap Nominatim API (free, no API key required).
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  country?: string;
  city?: string;
}

/**
 * Geocode a city name to get coordinates and country
 */
export async function geocodeCity(
  cityName: string,
  country?: string
): Promise<GeocodeResult | null> {
  if (!cityName.trim()) return null;

  try {
    const query = country
      ? `${cityName}, ${country}`
      : cityName;
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'ForesightMap/1.0', // Required by Nominatim
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
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
  } catch (error) {
    console.error("Error geocoding city:", error);
    return null;
  }
}

/**
 * Geocode just the country from a city name
 */
export async function geocodeCountry(cityName: string): Promise<string | null> {
  const result = await geocodeCity(cityName);
  return result?.country || null;
}

