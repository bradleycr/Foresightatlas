import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { divIcon, LatLngBounds } from "leaflet";
import { Person, TravelWindow, RoleType } from "../types";
import { FellowCard } from "./FellowCard";
import { MapPin, Users, List, X } from "lucide-react";
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

/**
 * Creates a beautiful gradient that blends multiple role type colors
 * When multiple roles are present, creates a smooth gradient mix
 */
const createRoleBasedGradient = (roleTypes: Set<RoleType>): string => {
  const roles = Array.from(roleTypes);
  
  // Single role type - use its dedicated color
  if (roles.length === 1) {
    const color = ROLE_COLORS[roles[0]];
    return `linear-gradient(135deg, ${color.start} 0%, ${color.end} 100%)`;
  }
  
  // Multiple role types - create a beautiful blended gradient
  if (roles.length === 2) {
    const [role1, role2] = roles;
    const color1 = ROLE_COLORS[role1];
    const color2 = ROLE_COLORS[role2];
    // Create a smooth diagonal blend transitioning between the two colors
    return `linear-gradient(135deg, ${color1.start} 0%, ${color1.end} 40%, ${color2.start} 60%, ${color2.end} 100%)`;
  }
  
  // All three role types - create a tri-color gradient
  if (roles.length === 3) {
    const [role1, role2, role3] = roles;
    const color1 = ROLE_COLORS[role1];
    const color2 = ROLE_COLORS[role2];
    const color3 = ROLE_COLORS[role3];
    // Beautiful three-way gradient blend with smooth transitions
    return `linear-gradient(135deg, ${color1.start} 0%, ${color1.end} 30%, ${color2.start} 35%, ${color2.end} 65%, ${color3.start} 70%, ${color3.end} 100%)`;
  }
  
  // Fallback (shouldn't happen)
  return `linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)`;
};

// Create custom icon for markers with badge (moved outside component)
const createCustomIcon = (
  count: number,
  roleTypes: Set<RoleType>,
  isSelected: boolean,
  foresightIcon: string
) => {
  const gradient = createRoleBasedGradient(roleTypes);
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
        background: ${gradient};
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
  useEffect(() => {
    const geocodeCoordinates = async () => {
      const coordsToGeocode = new Set<string>();
      
      // Collect all unique coordinates that need geocoding
      filteredPeople.forEach((person) => {
        if (granularity === "Year") {
          const coordinates = person.currentCoordinates;
          if (coordinates.lat !== 0 && coordinates.lng !== 0) {
            // If homeBaseCity is empty, we need to reverse geocode to get the actual city
            if (!person.homeBaseCity || !person.homeBaseCountry) {
              const geocodeKey = `${coordinates.lat},${coordinates.lng}`;
              if (!geocodedCities.has(geocodeKey)) {
                coordsToGeocode.add(geocodeKey);
              }
            }
          }
        }
      });
      
      // Only geocode if we have new coordinates to process
      if (coordsToGeocode.size === 0) return;
      
      // Reverse geocode coordinates with rate limiting (Nominatim allows 1 req/sec)
      // Process sequentially with delays to respect API limits
      const results: Array<{ coordKey: string; city: string; country: string } | null> = [];
      const coordsArray = Array.from(coordsToGeocode).slice(0, 10); // Limit to 10 to avoid long waits
      
      for (let i = 0; i < coordsArray.length; i++) {
        // Wait 1 second between requests to respect rate limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
        
        const coordKey = coordsArray[i];
        const [lat, lng] = coordKey.split(',').map(Number);
        const result = await reverseGeocode(lat, lng);
        
        if (result) {
          results.push({ coordKey, city: result.city, country: result.country });
        } else {
          results.push(null);
        }
      }
      
      const results = await Promise.all(geocodePromises);
      
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
  }, [filteredPeople, granularity]); // Don't include geocodedCities to avoid infinite loop

  // Calculate markers based on current time window and granularity
  const markers = useMemo(() => {
    // Use coordinate-based keys to group markers by actual location, not city name
    // This ensures the popup shows the city where the pin actually is
    const markerMap = new Map<string, MarkerData>();

    filteredPeople.forEach((person) => {
      // For Year view: Always show home base (or current location if no home base)
      // For Month/Week view: Show where they are during that time (trip if applicable, otherwise home base)
      if (granularity === "Year") {
        // Year view: Show home base, ignore trips
        // Note: primaryNode (Bay Area Node, Berlin Node, Global) is organizational, not geographical
        // So we only use homeBaseCity/homeBaseCountry, or fall back to currentCity/currentCountry
        
        // IMPORTANT: In Year view, we want to show where people are "based"
        // If homeBaseCity is empty, we can't reliably show them because currentCity
        // might be a temporary travel location that doesn't match currentCoordinates
        // So we prioritize homeBaseCity and only use currentCity if homeBaseCity is truly not set
        
        let homeCity: string;
        let homeCountry: string;
        let coordinates = person.currentCoordinates;
        
        if (person.homeBaseCity && person.homeBaseCountry) {
          // Use home base - this is the preferred location for Year view
          homeCity = person.homeBaseCity;
          homeCountry = person.homeBaseCountry;
          // Note: We use currentCoordinates as coordinates since Person type doesn't have homeBaseCoordinates
          // This assumes home base and current location are the same or close
        } else if (person.currentCity && person.currentCountry) {
          // Fallback: Try to use reverse geocoded city name if available
          // This ensures popup shows the city where the pin actually is
          const geocodeKey = `${coordinates.lat},${coordinates.lng}`;
          const geocoded = geocodedCities.get(geocodeKey);
          
          if (geocoded) {
            // Use reverse geocoded city name (matches the coordinates)
            homeCity = geocoded.city;
            homeCountry = geocoded.country;
          } else {
            // Fallback to currentCity (might not match coordinates, but better than nothing)
            homeCity = person.currentCity;
            homeCountry = person.currentCountry;
          }
        } else {
          // Skip if no location data at all
          return;
        }
        
        // Only show if we have valid location data
        if (homeCity && homeCountry && coordinates.lat !== 0 && coordinates.lng !== 0) {
          // Group by coordinates only to aggregate all people at the same location
          // This ensures role type colors work correctly
          const coordKey = getCoordinateKey(coordinates);
          
          if (!markerMap.has(coordKey)) {
            markerMap.set(coordKey, {
              city: homeCity,
              country: homeCountry,
              coordinates: coordinates,
              people: [],
            });
          }
          markerMap.get(coordKey)!.people.push({ person });
          
          // Update city name if we have a better match
          // Priority: homeBaseCity > geocoded city > current city
          const existingMarker = markerMap.get(coordKey)!;
          const geocodeKey = `${coordinates.lat},${coordinates.lng}`;
          const geocoded = geocodedCities.get(geocodeKey);
          
          // If this person has homeBaseCity, use it (most reliable)
          if (person.homeBaseCity && person.homeBaseCountry) {
            existingMarker.city = person.homeBaseCity;
            existingMarker.country = person.homeBaseCountry;
          } 
          // Otherwise, if geocoded city is available, use it (matches coordinates)
          else if (geocoded) {
            existingMarker.city = geocoded.city;
            existingMarker.country = geocoded.country;
          }
          // Otherwise keep the current city name (might not match coordinates, but it's what we have)
        }
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
              
              if (!markerMap.has(coordKey)) {
                // Use travel window city/country for the popup
                markerMap.set(coordKey, {
                  city: tw.city,
                  country: tw.country,
                  coordinates: tw.coordinates,
                  people: [],
                });
              }
              markerMap.get(coordKey)!.people.push({ person, travelWindow: tw });
            }
          });
        } else {
          // No trips in this time period, show home base (or current location if no home base)
          const homeCity = person.homeBaseCity || person.currentCity;
          const homeCountry = person.homeBaseCountry || person.currentCountry;
          
          if (homeCity && homeCountry && person.currentCoordinates.lat !== 0 && person.currentCoordinates.lng !== 0) {
            // Group by coordinates only to aggregate all people at the same location
            const coordKey = getCoordinateKey(person.currentCoordinates);
            
            if (!markerMap.has(coordKey)) {
              markerMap.set(coordKey, {
                city: homeCity,
                country: homeCountry,
                coordinates: person.currentCoordinates,
                people: [],
              });
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
        <p className="text-center text-gray-500 py-8">
          No fellows or grantees match your filters
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
                // Highlight in the list and focus the corresponding marker
                openSidebarAndScrollToPerson(person.id);
                const personMarker = markers.find((m) =>
                  m.people.some((p) => p.person.id === person.id)
                );
                if (personMarker) {
                  setSelectedMarker(personMarker);
                  // Popup will open automatically when marker is clicked/selected
                }
              }}
              onViewDetails={() => {
                onViewPersonDetails?.(person.id);
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
      <div className="flex-1 bg-white rounded-xl overflow-hidden relative min-h-[400px] sm:min-h-[500px] lg:min-h-0 shadow-lg border border-gray-100">
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
                        setSelectedMarker(marker);
                        if (marker.people.length === 1) {
                          setSelectedPerson(marker.people[0].person.id);
                        }
                        // On mobile, if there's only one person, open the detail modal directly
                        if (isMobile && marker.people.length === 1 && onViewPersonDetails) {
                          // Small delay to ensure popup doesn't interfere
                          setTimeout(() => {
                            onViewPersonDetails(marker.people[0].person.id);
                          }, 100);
                        }
                      }
                    },
                  }}
                >
                  <Popup 
                    className="custom-popup"
                    autoPan={true}
                    autoPanPadding={[50, 50]}
                    keepInView={true}
                  >
                    <div 
                      className="overflow-hidden"
                      style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)'
                      }}
                    >
                      {/* Clean, subtle header */}
                      <div 
                        className="px-4 py-3 pr-12 border-b border-gray-200/60 relative"
                        style={{
                          background: 'linear-gradient(to bottom, #ffffff 0%, #fafafa 100%)'
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h4 
                              className="font-semibold text-gray-900 text-base leading-tight" 
                              style={{ fontFamily: 'var(--font-heading)' }}
                            >
                              {marker.city}, {marker.country}
                            </h4>
                            <p className="text-xs text-gray-600 mt-1">
                              {marker.people.length} {marker.people.length === 1 ? 'person' : 'people'}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* People list with beautiful cards */}
                      <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
                        {marker.people.map(({ person, travelWindow }, personIdx) => {
                          // Soft cards behind each person entry
                          const cardGradients = [
                            'linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)', // Mint to White
                            'linear-gradient(135deg, #fef3f2 0%, #ffffff 100%)', // Rose to White
                            'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)', // Sky to White
                            'linear-gradient(135deg, #faf5ff 0%, #ffffff 100%)', // Purple to White
                            'linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)', // Orange to White
                            'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)', // Green to White
                          ];
                          const cardGradient = cardGradients[personIdx % cardGradients.length];
                          
                          return (
                            <div
                              key={person.id}
                              className="p-3 rounded-lg cursor-pointer transition-all hover:shadow-md border border-gray-200/60"
                              style={{
                                background: cardGradient
                              }}
                              onClick={() => openSidebarAndScrollToPerson(person.id)}
                            >
                              <p className="text-sm text-gray-900 font-semibold">{person.fullName}</p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span 
                                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                                  style={{
                                    background: getRoleGradient(person.roleType),
                                    color: '#374151'
                                  }}
                                >
                                  {person.roleType}
                                </span>
                                {person.focusTags.slice(0, 2).map((tag, tagIdx) => (
                                  <span
                                    key={tag}
                                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{
                                      background: tagIdx === 0 
                                        ? 'linear-gradient(135deg, #e9d5ff 0%, #fbcfe8 100%)'
                                        : 'linear-gradient(135deg, #a5f3fc 0%, #67e8f9 100%)',
                                      color: '#374151'
                                    }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              {travelWindow && (
                                <div className="mt-2 pt-2 border-t border-gray-200/50">
                                  <p className="text-xs text-gray-600 font-medium">
                                    📅 {new Date(travelWindow.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(travelWindow.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No locations to display
          </div>
        )}

        {/* Map Info Overlay with Gradient and Color Legend */}
        <div 
          className="absolute bottom-4 left-4 sm:bottom-4 sm:left-4 rounded-xl shadow-lg p-3 sm:p-4 border border-white/20 backdrop-blur-sm z-[1000] pointer-events-auto"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.98) 100%)'
          }}
        >
          {/* Stats Row */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-700 mb-3 pb-3 border-b border-gray-200/60">
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3 sm:size-4 text-blue-500 flex-shrink-0" />
              <span className="hidden sm:inline">{markers.length} locations</span>
              <span className="sm:hidden">{markers.length}</span>
            </div>
            <span className="text-gray-400 hidden sm:inline">·</span>
            <div className="flex items-center gap-1.5">
              <Users className="size-3 sm:size-4 text-purple-500 flex-shrink-0" />
              <span className="hidden sm:inline">{filteredPeople.length} people</span>
              <span className="sm:hidden">{filteredPeople.length}</span>
            </div>
          </div>
          
          {/* Color Legend */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700 mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              Pin Colors
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0 border border-white shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${ROLE_COLORS.Fellow.start} 0%, ${ROLE_COLORS.Fellow.end} 100%)`
                  }}
                />
                <span className="text-xs text-gray-600">Fellow</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0 border border-white shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${ROLE_COLORS.Grantee.start} 0%, ${ROLE_COLORS.Grantee.end} 100%)`
                  }}
                />
                <span className="text-xs text-gray-600">Grantee</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0 border border-white shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${ROLE_COLORS['Prize Winner'].start} 0%, ${ROLE_COLORS['Prize Winner'].end} 100%)`
                  }}
                />
                <span className="text-xs text-gray-600">Prize Winner</span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-gray-200/40">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0 border border-white shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${ROLE_COLORS.Fellow.start} 0%, ${ROLE_COLORS.Fellow.end} 50%, ${ROLE_COLORS.Grantee.start} 50%, ${ROLE_COLORS.Grantee.end} 100%)`
                  }}
                />
                <span className="text-xs text-gray-500 italic">Mixed roles</span>
              </div>
            </div>
          </div>
        </div>

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
        <div className="w-full lg:w-96 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col max-h-[500px] lg:max-h-none relative" style={{ zIndex: Z_INDEX_SIDEBAR }}>
          <div 
            className="p-4 border-b border-gray-200 flex items-center justify-between relative"
            style={{
              background: 'linear-gradient(135deg, #fafafa 0%, #f9fafb 100%)',
            }}
          >
            <div>
              <h3 className="text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                Fellows & Grantees
              </h3>
              <p className="text-sm text-gray-600">{filteredPeople.length} people</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-900 relative"
              onClick={() => setIsSidebarOpen(false)}
            >
              Hide list
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {peopleListContent}
          </div>
        </div>
      )}

      {/* Mobile: full-screen fellows sheet */}
      {isMobile && isSidebarOpen && (
        <div className="fixed inset-0 bg-white flex flex-col shadow-2xl" style={{ zIndex: Z_INDEX_MODAL_CONTENT }}>
          <div 
            className="px-6 py-4 border-b border-gray-200 flex items-center justify-between relative gap-3"
            style={{
              background: 'linear-gradient(135deg, #fafafa 0%, #f9fafb 100%)',
            }}
          >
            <div className="flex-1 min-w-0">
              <h3 className="text-gray-900 text-lg font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                Fellows & Grantees
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">{filteredPeople.length} people</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-gray-300 text-gray-700 bg-white/80 relative flex-shrink-0"
              onClick={() => setIsSidebarOpen(false)}
            >
              Back to map
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {peopleListContent}
          </div>
        </div>
      )}
    </div>
  );
}

