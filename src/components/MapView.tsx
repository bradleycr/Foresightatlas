import React, { useState, useMemo, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import { divIcon, LatLngBounds } from "leaflet";
import { Person, TravelWindow, RoleType } from "../types";
import { FellowCard } from "./FellowCard";
import { List, X } from "lucide-react";
import { Button } from "./ui/button";
import { useIsMobile } from "./ui/use-mobile";
import { ROLE_COLORS, getRoleGradient } from "../styles/roleColors";
import { Z_INDEX_MAP_CONTROLS, Z_INDEX_SIDEBAR, Z_INDEX_MODAL_CONTENT } from "../constants/zIndex";
import { reverseGeocode } from "../services/geocoding";
// @ts-ignore - Image import via alias
import foresightIcon from "@/assets/Foresight_RGB_Icon_Black.png";

interface MapViewProps {
  filteredPeople: Person[];
  filteredTravelWindows: TravelWindow[];
  timeWindowStart: Date;
  timeWindowEnd: Date;
  granularity?: "Year" | "Month" | "Week";
  onViewPersonDetails?: (personId: string) => void;
}

interface MarkerData {
  city: string;
  country: string;
  coordinates: { lat: number; lng: number };
  people: Array<{
    person: Person;
    travelWindow?: TravelWindow;
  }>;
}

// Helper to create a coordinate-based key for grouping markers
// We group by coordinates only to ensure all people at the same location are aggregated
// The city name in the popup will come from the marker data (first person's city or travel window city)
const getCoordinateKey = (coords: { lat: number; lng: number }): string => {
  // Round coordinates to ~1km precision (0.01 degree) for grouping nearby locations
  // This ensures people at the exact same location are grouped together
  const roundedLat = Math.round(coords.lat * 100) / 100;
  const roundedLng = Math.round(coords.lng * 100) / 100;
  return `${roundedLat},${roundedLng}`;
};

// Component to fit map bounds to markers
function FitBounds({ markers, skipIfMarkerSelected }: { markers: MarkerData[]; skipIfMarkerSelected?: boolean }) {
  const map = useMap();

  useEffect(() => {
    // Skip fitting bounds if a marker is selected (user is interacting with map)
    if (skipIfMarkerSelected) {
      return;
    }
    // Set max bounds to prevent grey blank areas
    const worldBounds = new LatLngBounds([[-85, -180], [85, 180]]);
    map.setMaxBounds(worldBounds);
    map.options.maxBounds = worldBounds;
    map.options.maxBoundsViscosity = 1.0; // Prevent panning outside bounds
    map.options.worldCopyJump = true; // Allow world copy jump to prevent gray areas
    
    // Ensure minimum zoom level to prevent over-zooming and grey areas
    map.setMinZoom(2.5);
    
    // If current zoom is below minimum, set it to minimum
    if (map.getZoom() < 2.5) {
      map.setZoom(2.5);
    }
    
    // Ensure map fits properly to prevent gray edges
    map.invalidateSize();

    if (markers.length === 0) {
      // Set default view to show California when no markers
      map.setView([30, -120], 2.0);
      return;
    }

    // Wait for map to be fully initialized before fitting bounds
    const fitBoundsToMarkers = () => {
      // Ensure map knows its container size
      map.invalidateSize();
      
      if (markers.length === 1) {
        const zoom = Math.max(6, 2.5); // Ensure never below minimum
        map.setView([markers[0].coordinates.lat, markers[0].coordinates.lng], zoom);
        return;
      }

      const bounds = new LatLngBounds(
        markers.map((m) => [m.coordinates.lat, m.coordinates.lng])
      );
      
      // Use viewport-based padding for better results
      // Calculate padding as percentage of viewport for responsive behavior
      const container = map.getContainer();
      const containerHeight = container?.offsetHeight || 600;
      const containerWidth = container?.offsetWidth || 800;
      
      // Use 15% padding on all sides for nice breathing room
      const paddingTop = Math.round(containerHeight * 0.15);
      const paddingBottom = Math.round(containerHeight * 0.15);
      const paddingLeft = Math.round(containerWidth * 0.15);
      const paddingRight = Math.round(containerWidth * 0.15);
      
      // Also set a reasonable maxZoom to prevent over-zooming when markers are close
      map.fitBounds(bounds, { 
        padding: [paddingTop, paddingRight, paddingBottom, paddingLeft],
        maxZoom: 12, // Prevent over-zooming for better overview
        animate: false // Instant fit on initial load for better UX
      });
      
      // Ensure zoom never goes below minimum after fitBounds
      setTimeout(() => {
        if (map.getZoom() < 2.5) {
          map.setZoom(2.5);
        }
        // Double-check bounds are correct
        map.invalidateSize();
      }, 150);
    };

    // Wait for map to be ready - use multiple attempts to ensure it works
    const attemptFit = () => {
      const container = map.getContainer();
      if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
        fitBoundsToMarkers();
      } else {
        // Retry if container not ready
        setTimeout(attemptFit, 50);
      }
    };
    
    // Start attempting after a short delay
    const timer = setTimeout(attemptFit, 150);
    
    return () => clearTimeout(timer);
  }, [map, markers, skipIfMarkerSelected]);

  return null;
}

// Simple component to zoom to selected marker
function ZoomToMarker({ marker }: { marker: MarkerData | null }) {
  const map = useMap();

  useEffect(() => {
    if (marker) {
      const targetZoom = 8;
      const finalZoom = Math.max(targetZoom, 2.5);
      
      // Simply center on the marker - let popup autoPan handle visibility
      map.flyTo(
        [marker.coordinates.lat, marker.coordinates.lng],
        finalZoom,
        { duration: 0.5 }
      );
    }
  }, [map, marker]);

  return null;
}

// Component to invalidate map size when sidebar state changes
function MapResizer({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  const map = useMap();

  useEffect(() => {
    // Use a delay to ensure DOM has updated after sidebar animation
    // Leaflet needs time to recalculate after layout changes
    const timer = setTimeout(() => {
      map.invalidateSize();
      // Force a second resize check to catch any edge cases
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [map, isSidebarOpen]);

  return null;
}

// Canonical order for segment layout so the badge always looks consistent
const ROLE_ORDER: RoleType[] = ["Fellow", "Grantee", "Prize Winner"];

/**
 * Badge background: one color for a single role type; segmented (halves or thirds)
 * for multiple types so you can see the mix at a glance.
 */
const createRoleBasedBadgeBackground = (roleTypes: Set<RoleType>): string => {
  const roles = ROLE_ORDER.filter((r) => roleTypes.has(r));
  if (roles.length === 0) return "linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)";
  if (roles.length === 1) {
    const { start, end } = ROLE_COLORS[roles[0]];
    return `linear-gradient(135deg, ${start} 0%, ${end} 100%)`;
  }
  if (roles.length === 2) {
    const [a, b] = roles.map((r) => ROLE_COLORS[r].end);
    return `conic-gradient(${a} 0deg 180deg, ${b} 180deg 360deg)`;
  }
  // Three types: thirds
  const [a, b, c] = roles.map((r) => ROLE_COLORS[r].end);
  return `conic-gradient(${a} 0deg 120deg, ${b} 120deg 240deg, ${c} 240deg 360deg)`;
};

// Create custom icon for markers with badge (moved outside component)
const createCustomIcon = (
  count: number,
  roleTypes: Set<RoleType>,
  isSelected: boolean,
  foresightIcon: string
) => {
  const background = createRoleBasedBadgeBackground(roleTypes);
  const iconSize = isSelected ? 48 : 40;
  const badgeSize = isSelected ? 28 : 24;

  const iconHtml = `
    <div style="position: relative; width: ${iconSize}px; height: ${iconSize}px;">
      <img 
        src="${foresightIcon}" 
        alt="Location" 
        style="width: ${iconSize}px; height: ${iconSize}px; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));"
      />
      <div style="
        position: absolute;
        top: -8px;
        right: -8px;
        width: ${badgeSize}px;
        height: ${badgeSize}px;
        border-radius: 50%;
        background: ${background};
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        font-weight: 600;
        font-size: ${isSelected ? '12px' : '10px'};
        color: #374151;
      ">
        ${count}
      </div>
    </div>
  `;

  return divIcon({
    html: iconHtml,
    className: 'custom-marker-icon',
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize],
    popupAnchor: [0, -iconSize],
  });
};


export function MapView({
  filteredPeople,
  filteredTravelWindows,
  timeWindowStart,
  timeWindowEnd,
  granularity = "Year",
  onViewPersonDetails,
}: MapViewProps) {
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  
  // Cache for reverse geocoded city names (coordinates -> city, country)
  const [geocodedCities, setGeocodedCities] = useState<Map<string, { city: string; country: string }>>(new Map());

  // Keep refs to each person card so we can scroll them into view
  const personRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // On mobile, default to map-first experience with the list hidden
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

  // Reverse geocode coordinates to get actual city names (for cases where city data doesn't match coordinates)
  // CRITICAL: We ALWAYS reverse geocode ALL coordinates to ensure popup shows the city where the pin actually is
  useEffect(() => {
    const geocodeCoordinates = async () => {
      // Map of coordinates to expected city/country for validation
      const coordsToGeocode = new Map<string, { expectedCity?: string; expectedCountry?: string }>();
      
      // Collect all unique coordinates that need geocoding, along with expected values
      filteredPeople.forEach((person) => {
        if (granularity === "Year") {
          const coordinates = person.currentCoordinates;
          if (coordinates.lat !== 0 && coordinates.lng !== 0) {
            // ALWAYS reverse geocode to get the actual city at these coordinates
            // This ensures popup shows the city where the pin is, not the person's data
            const geocodeKey = `${coordinates.lat},${coordinates.lng}`;
            if (!geocodedCities.has(geocodeKey)) {
              // Store expected values for validation
              const expectedCity = person.currentCity;
              const expectedCountry = person.currentCountry;
              
              // If coordinate already in map, merge expected values (take first non-empty)
              const existing = coordsToGeocode.get(geocodeKey);
              if (!existing || (!existing.expectedCity && expectedCity)) {
                coordsToGeocode.set(geocodeKey, {
                  expectedCity: existing?.expectedCity || expectedCity,
                  expectedCountry: existing?.expectedCountry || expectedCountry,
                });
              }
            }
          }
        } else {
          // Month/Week view: also geocode coordinates for people without trips
          const personTravelWindows = filteredTravelWindows.filter(
            (tw) =>
              tw.personId === person.id &&
              new Date(tw.startDate) <= timeWindowEnd &&
              new Date(tw.endDate) >= timeWindowStart
          );

          if (personTravelWindows.length === 0) {
            // No trips, use current location coordinates
            const coordinates = person.currentCoordinates;
            if (coordinates.lat !== 0 && coordinates.lng !== 0) {
              const geocodeKey = `${coordinates.lat},${coordinates.lng}`;
              if (!geocodedCities.has(geocodeKey)) {
                const expectedCity = person.currentCity;
                const expectedCountry = person.currentCountry;
                const existing = coordsToGeocode.get(geocodeKey);
                if (!existing || (!existing.expectedCity && expectedCity)) {
                  coordsToGeocode.set(geocodeKey, {
                    expectedCity: existing?.expectedCity || expectedCity,
                    expectedCountry: existing?.expectedCountry || expectedCountry,
                  });
                }
              }
            }
          } else {
            // Also geocode trip coordinates to verify they match
            personTravelWindows.forEach((tw) => {
              if (tw.coordinates.lat !== 0 && tw.coordinates.lng !== 0) {
                const geocodeKey = `${tw.coordinates.lat},${tw.coordinates.lng}`;
                if (!geocodedCities.has(geocodeKey)) {
                  // For travel windows, use the travel window city/country as expected
                  const expectedCity = tw.city;
                  const expectedCountry = tw.country;
                  const existing = coordsToGeocode.get(geocodeKey);
                  if (!existing || (!existing.expectedCity && expectedCity)) {
                    coordsToGeocode.set(geocodeKey, {
                      expectedCity: existing?.expectedCity || expectedCity,
                      expectedCountry: existing?.expectedCountry || expectedCountry,
                    });
                  }
                }
              }
            });
          }
        }
      });
      
      // Only geocode if we have new coordinates to process
      if (coordsToGeocode.size === 0) return;
      
      // Reverse geocode coordinates with rate limiting (Nominatim allows 1 req/sec)
      // Process sequentially with delays to respect API limits
      const results: Array<{ coordKey: string; city: string; country: string } | null> = [];
      const coordsArray = Array.from(coordsToGeocode.entries()).slice(0, 20); // Increased limit for better coverage
      
      for (let i = 0; i < coordsArray.length; i++) {
        // Wait 1 second between requests to respect rate limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
        
        const [coordKey, { expectedCity, expectedCountry }] = coordsArray[i];
        const [lat, lng] = coordKey.split(',').map(Number);
        
        // Call reverse geocode with expected values for validation
        const result = await reverseGeocode(lat, lng, expectedCity, expectedCountry);
        
        if (result) {
          results.push({ coordKey, city: result.city, country: result.country });
        } else {
          // If reverse geocoding failed or was invalid, we'll use fallback in marker creation
          results.push(null);
        }
      }
      
      // Check if we got any new results
      const hasNewResults = results.some((result) => {
        if (!result) return false;
        return !geocodedCities.has(result.coordKey);
      });
      
      if (hasNewResults) {
        // Create a new Map instance so React detects the change
        const newGeocoded = new Map(geocodedCities);
        results.forEach((result) => {
          if (result) {
            newGeocoded.set(result.coordKey, { city: result.city, country: result.country });
          }
        });
        setGeocodedCities(newGeocoded);
      }
    };
    
    geocodeCoordinates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPeople, filteredTravelWindows, granularity, timeWindowStart, timeWindowEnd]); // Don't include geocodedCities to avoid infinite loop

  // Calculate markers based on current time window and granularity
  const markers = useMemo(() => {
    // Use coordinate-based keys to group markers by actual location, not city name
    // This ensures the popup shows the city where the pin actually is
    const markerMap = new Map<string, MarkerData>();

    filteredPeople.forEach((person) => {
      // For Year view: Show current location. For Month/Week: Show where they are (trip if in range, else current location).
      if (granularity === "Year") {
        // Year view: Show current location only
        const coordinates = person.currentCoordinates;
        const city = person.currentCity;
        const country = person.currentCountry;
        if (!city || !country || coordinates.lat === 0 || coordinates.lng === 0) return;
        
        const coordKey = getCoordinateKey(coordinates);
        const geocodeKey = `${coordinates.lat},${coordinates.lng}`;
        const geocoded = geocodedCities.get(geocodeKey);
        
        let displayCity: string;
        let displayCountry: string;
        if (geocoded) {
          const expectedCity = person.currentCity;
          const expectedCountry = person.currentCountry;
          const geocodedLower = geocoded.city.toLowerCase().trim();
          const expectedLower = expectedCity?.toLowerCase().trim() || '';
          const citiesMatch = expectedLower && (
            geocodedLower === expectedLower ||
            geocodedLower.includes(expectedLower) ||
            expectedLower.includes(geocodedLower) ||
            (geocodedLower.includes('san fran') && expectedLower.includes('san francisco')) ||
            (geocodedLower.includes('berlin') && expectedLower.includes('berlin')) ||
            (geocodedLower.includes('bangalore') && expectedLower.includes('bengaluru')) ||
            (geocodedLower.includes('bengaluru') && expectedLower.includes('bangalore'))
          );
          if (expectedCity && expectedCountry && !citiesMatch) {
            console.warn(`⚠️ City mismatch: coordinates suggest "${geocoded.city}, ${geocoded.country}" but person data says "${expectedCity}, ${expectedCountry}". Using person data.`);
            displayCity = expectedCity;
            displayCountry = expectedCountry;
          } else {
            displayCity = geocoded.city;
            displayCountry = geocoded.country;
          }
        } else {
          displayCity = city;
          displayCountry = country;
        }
          
          if (!markerMap.has(coordKey)) {
            markerMap.set(coordKey, {
              city: displayCity,
              country: displayCountry,
              coordinates: coordinates,
              people: [],
            });
          } else {
            // Update existing marker with reverse geocoded city if available
            // This ensures popup always shows the city where the pin is
            const existingMarker = markerMap.get(coordKey)!;
            if (geocoded) {
              existingMarker.city = geocoded.city;
              existingMarker.country = geocoded.country;
            }
          }
          markerMap.get(coordKey)!.people.push({ person });
      } else {
        // Month/Week view: Show where they are during the selected time period
        // Get travel windows for this person in the time range
        const personTravelWindows = filteredTravelWindows.filter(
          (tw) =>
            tw.personId === person.id &&
            new Date(tw.startDate) <= timeWindowEnd &&
            new Date(tw.endDate) >= timeWindowStart
        );

        if (personTravelWindows.length > 0) {
          // Show trip locations - group by coordinates to aggregate people at same location
          personTravelWindows.forEach((tw) => {
            if (tw.coordinates.lat !== 0 && tw.coordinates.lng !== 0) {
              const coordKey = getCoordinateKey(tw.coordinates);
              const geocodeKey = `${tw.coordinates.lat},${tw.coordinates.lng}`;
              const geocoded = geocodedCities.get(geocodeKey);
              
              // CRITICAL: Smart fallback - if reverse geocoded doesn't match travel window city, use travel window
              let displayCity: string;
              let displayCountry: string;
              
              if (geocoded) {
                const geocodedLower = geocoded.city.toLowerCase().trim();
                const twCityLower = tw.city.toLowerCase().trim();
                
                const citiesMatch = geocodedLower === twCityLower ||
                  geocodedLower.includes(twCityLower) ||
                  twCityLower.includes(geocodedLower);
                
                if (!citiesMatch) {
                  // Cities don't match - coordinates might be wrong, use travel window city
                  console.warn(`⚠️ Travel window city mismatch: coordinates suggest "${geocoded.city}" but travel window says "${tw.city}". Using travel window data.`);
                  displayCity = tw.city;
                  displayCountry = tw.country;
                } else {
                  // Cities match - use reverse geocoded
                  displayCity = geocoded.city;
                  displayCountry = geocoded.country;
                }
              } else {
                // No reverse geocoding available yet - use travel window city
                displayCity = tw.city;
                displayCountry = tw.country;
              }
              
              if (!markerMap.has(coordKey)) {
                markerMap.set(coordKey, {
                  city: displayCity,
                  country: displayCountry,
                  coordinates: tw.coordinates,
                  people: [],
                });
              } else {
                // Update existing marker with reverse geocoded city if available
                const existingMarker = markerMap.get(coordKey)!;
                if (geocoded) {
                  existingMarker.city = geocoded.city;
                  existingMarker.country = geocoded.country;
                }
              }
              markerMap.get(coordKey)!.people.push({ person, travelWindow: tw });
            }
          });
        } else {
          // No trips in this time period, show current location
          const coordinates = person.currentCoordinates;
          if (coordinates.lat !== 0 && coordinates.lng !== 0) {
            const coordKey = getCoordinateKey(coordinates);
            const geocodeKey = `${coordinates.lat},${coordinates.lng}`;
            const geocoded = geocodedCities.get(geocodeKey);
            
            let displayCity: string;
            let displayCountry: string;
            
            if (geocoded) {
              const expectedCity = person.currentCity;
              const expectedCountry = person.currentCountry;
              
              const geocodedLower = geocoded.city.toLowerCase().trim();
              const expectedLower = expectedCity?.toLowerCase().trim() || '';
              
              const citiesMatch = expectedLower && (
                geocodedLower === expectedLower ||
                geocodedLower.includes(expectedLower) ||
                expectedLower.includes(geocodedLower) ||
                (geocodedLower.includes('san fran') && expectedLower.includes('san francisco')) ||
                (geocodedLower.includes('berlin') && expectedLower.includes('berlin')) ||
                (geocodedLower.includes('bangalore') && expectedLower.includes('bengaluru')) ||
                (geocodedLower.includes('bengaluru') && expectedLower.includes('bangalore'))
              );
              
              if (expectedCity && expectedCountry && !citiesMatch) {
                console.warn(`⚠️ City mismatch (Month/Week): coordinates suggest "${geocoded.city}" but person data says "${expectedCity}". Using person data.`);
                displayCity = expectedCity;
                displayCountry = expectedCountry;
              } else {
                displayCity = geocoded.city;
                displayCountry = geocoded.country;
              }
            } else if (person.currentCity && person.currentCountry) {
              displayCity = person.currentCity;
              displayCountry = person.currentCountry;
            } else {
              return; // Skip if no location data
            }
            
            if (!markerMap.has(coordKey)) {
              markerMap.set(coordKey, {
                city: displayCity,
                country: displayCountry,
                coordinates: coordinates,
                people: [],
              });
            } else {
              // Update existing marker with reverse geocoded city if available
              const existingMarker = markerMap.get(coordKey)!;
              if (geocoded) {
                existingMarker.city = geocoded.city;
                existingMarker.country = geocoded.country;
              }
            }
            markerMap.get(coordKey)!.people.push({ person });
          }
        }
      }
    });

    return Array.from(markerMap.values());
  }, [filteredPeople, filteredTravelWindows, timeWindowStart, timeWindowEnd, granularity, geocodedCities]);

  // Get next travel window for each person
  const getNextTravel = (personId: string): TravelWindow | undefined => {
    const personWindows = filteredTravelWindows
      .filter((tw) => tw.personId === personId)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    return personWindows.find((tw) => new Date(tw.startDate) >= new Date());
  };

  // Beautiful helper: open the list and glide directly to the selected fellow
  const openSidebarAndScrollToPerson = (personId: string) => {
    setSelectedPerson(personId);
    setIsSidebarOpen(true);

    // Wait for the sidebar to render, then scroll smoothly to the card
    requestAnimationFrame(() => {
      const el = personRefs.current[personId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };


  // Shared people list content used in both desktop sidebar and mobile sheet
  const peopleListContent = (
    <>
      {filteredPeople.length === 0 ? (
        <p className="text-center text-gray-500 py-8 text-sm">
          No people match your filters. Try changing search, year, or filter options.
        </p>
      ) : (
        filteredPeople.map((person) => (
          <div
            key={person.id}
            ref={(el) => {
              personRefs.current[person.id] = el;
            }}
          >
            <FellowCard
              person={person}
              nextTravel={getNextTravel(person.id)}
              onSelect={() => {
                // Open the details modal and keep list/map in sync
                onViewPersonDetails?.(person.id);
                openSidebarAndScrollToPerson(person.id);
                const personMarker = markers.find((m) =>
                  m.people.some((p) => p.person.id === person.id)
                );
                if (personMarker) setSelectedMarker(personMarker);
              }}
              isHighlighted={selectedPerson === person.id}
            />
          </div>
        ))
      )}
    </>
  );

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 relative">
      {/* Map Panel */}
      <div className="flex-1 bg-white rounded-xl overflow-hidden relative min-h-[400px] sm:min-h-[500px] lg:h-full shadow-lg border border-gray-100">
        {markers.length > 0 ? (
          <MapContainer
            center={[30, -120]}
            zoom={2.0}
            minZoom={2.5}
            maxZoom={18}
            maxBounds={[[-85, -180], [85, 180]]}
            maxBoundsViscosity={1.0}
            worldCopyJump={true}
            style={{ height: '100%', width: '100%', position: 'relative' }}
            className="rounded-xl"
            zoomControl={true}
            scrollWheelZoom={true}
            touchZoom={true}
            doubleClickZoom={true}
            dragging={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              noWrap={false}
            />
            <FitBounds markers={markers} skipIfMarkerSelected={selectedMarker !== null} />
            <ZoomToMarker marker={selectedMarker} />
            <MapResizer isSidebarOpen={isSidebarOpen} />
            <MarkerClusterGroup
              maxClusterRadius={70}
              zoomToBoundsOnClick={true}
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
            >
            {markers.map((marker, idx) => {
              // Compare by coordinates to handle cases where multiple markers have same city name
              const isSelected = selectedMarker && 
                                Math.abs(selectedMarker.coordinates.lat - marker.coordinates.lat) < 0.001 &&
                                Math.abs(selectedMarker.coordinates.lng - marker.coordinates.lng) < 0.001;
              
              // Extract unique role types present at this location
              const roleTypes = new Set<RoleType>(
                marker.people.map(p => p.person.roleType)
              );
              
              const icon = createCustomIcon(marker.people.length, roleTypes, isSelected, foresightIcon);

              return (
                <Marker
                  key={`${marker.coordinates.lat},${marker.coordinates.lng}-${idx}`}
                  position={[marker.coordinates.lat, marker.coordinates.lng]}
                  icon={icon}
                  eventHandlers={{
                    click: () => {
                      if (isSelected) {
                        setSelectedMarker(null);
                        setSelectedPerson(null);
                      } else {
                        // Always show popup first: list everyone at this location.
                        // User then taps a person to open their detail modal.
                        setSelectedMarker(marker);
                        setSelectedPerson(null);
                      }
                    },
                  }}
                >
                  <Popup 
                    className="custom-popup map-node-popup"
                    autoPan={true}
                    autoPanPadding={[24, 24]}
                    keepInView={true}
                  >
                    <div className="map-node-popup__inner overflow-hidden bg-white">
                      {/* Compact header: location + count — tight vertical rhythm */}
                      <div className="px-3.5 pt-2.5 pb-2 pr-10 border-b border-gray-100/80">
                        <h4 
                          className="font-semibold text-gray-900 text-sm leading-tight sm:text-base tracking-tight" 
                          style={{ fontFamily: 'var(--font-heading)' }}
                        >
                          {marker.city}, {marker.country}
                        </h4>
                        <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                          {marker.people.length} {marker.people.length === 1 ? 'person' : 'people'} — tap for profile
                        </p>
                      </div>
                      {/* Compact people list: click a row to open that person’s profile modal */}
                      <div className="max-h-52 overflow-y-auto overscroll-contain">
                        {marker.people.map(({ person, travelWindow }) => (
                          <button
                            key={person.id}
                            type="button"
                            className="map-node-popup__person w-full text-left px-3.5 py-2 border-b border-gray-100/60 last:border-b-0 hover:bg-gray-50/80 active:bg-gray-100 transition-colors min-h-[44px] sm:min-h-[40px] flex flex-col justify-center gap-0.5"
                            onClick={() => {
                              openSidebarAndScrollToPerson(person.id);
                              onViewPersonDetails?.(person.id);
                            }}
                            aria-label={`View profile for ${person.fullName}`}
                          >
                            <span className="text-sm font-medium text-gray-900 truncate">{person.fullName}</span>
                            <div className="flex items-center gap-1 flex-wrap">
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-sm font-semibold shrink-0"
                                style={{
                                  background: getRoleGradient(person.roleType),
                                  color: '#374151'
                                }}
                              >
                                {person.roleType}
                              </span>
                              {person.isAlumni && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium bg-gray-100 text-gray-500 shrink-0">
                                  Alumni
                                </span>
                              )}
                              {person.focusTags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium bg-gray-50 text-gray-500 shrink-0 max-w-[80px] truncate"
                                  title={tag}
                                >
                                  {tag}
                                </span>
                              ))}
                              {travelWindow && (
                                <span className="text-[10px] text-gray-400 shrink-0 truncate max-w-[90px]">
                                  {new Date(travelWindow.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–{new Date(travelWindow.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            </MarkerClusterGroup>
          </MapContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2 px-4 text-center">
            <p>No locations to display.</p>
            <p className="text-sm">Try adjusting your filters or year.</p>
          </div>
        )}

        {/* Sidebar toggle - always visible, prominent button in top-right of map */}
        {!isMobile && (
          <div 
            className="absolute top-4 right-4 pointer-events-auto"
            style={{ 
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              zIndex: Z_INDEX_MAP_CONTROLS
            }}
          >
            <Button
              variant="outline"
              size="sm"
              className="bg-white border-gray-300 text-gray-800 hover:bg-gray-50 font-medium flex items-center gap-2 px-4 py-2"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                zIndex: Z_INDEX_MAP_CONTROLS
              }}
            >
              {isSidebarOpen ? (
                <>
                  <X className="size-4" />
                  <span className="hidden sm:inline">Hide list</span>
                  <span className="sm:hidden">Hide</span>
                </>
              ) : (
                <>
                  <List className="size-4" />
                  <span className="hidden sm:inline">Show list</span>
                  <span className="sm:hidden">List</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Mobile: open list button - positioned top-right to avoid zoom controls */}
      {isMobile && !isSidebarOpen && (
        <div 
          className="absolute pointer-events-auto" 
          style={{ 
            top: '1rem',
            right: '1rem',
            left: 'auto',
            zIndex: Z_INDEX_MAP_CONTROLS
          }}
        >
          <Button
            size="sm"
            className="shadow-lg border border-white/70 bg-white/95 backdrop-blur-sm text-gray-800 hover:bg-white font-medium"
            variant="outline"
            onClick={() => setIsSidebarOpen(true)}
          >
            Open list
          </Button>
        </div>
      )}

      {/* Fellows & Grantees List - desktop sidebar */}
      {!isMobile && isSidebarOpen && (
        <div className="w-full lg:w-96 bg-white rounded-xl shadow-lg ring-1 ring-gray-100/80 overflow-hidden flex flex-col max-h-[500px] lg:max-h-none relative" style={{ zIndex: Z_INDEX_SIDEBAR }}>
          <div 
            className="px-5 py-4 border-b border-gray-100 flex items-center justify-between relative"
            style={{
              background: 'linear-gradient(135deg, #fafafa 0%, #f9fafb 100%)',
            }}
          >
            <div>
              <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                Fellows & Grantees
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">{filteredPeople.length} people</p>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Hide
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {peopleListContent}
          </div>
        </div>
      )}

      {/* Mobile: full-screen fellows sheet — below modals so detail modal appears on top */}
      {isMobile && isSidebarOpen && (
        <div className="fixed inset-0 bg-white flex flex-col shadow-2xl" style={{ zIndex: Z_INDEX_SIDEBAR }}>
          <div 
            className="px-5 py-4 border-b border-gray-100 flex items-center justify-between relative gap-3"
            style={{
              background: 'linear-gradient(135deg, #fafafa 0%, #f9fafb 100%)',
            }}
          >
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                Fellows & Grantees
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">{filteredPeople.length} people</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-gray-200 text-gray-500 bg-white/80 relative flex-shrink-0 text-xs h-8 px-3"
              onClick={() => setIsSidebarOpen(false)}
            >
              Back to map
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {peopleListContent}
          </div>
        </div>
      )}
    </div>
  );
}

