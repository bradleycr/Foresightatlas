import React, { useState, useMemo, useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L, { divIcon, LatLngBounds } from "leaflet";
import { Person, TravelWindow, RoleType, Filters } from "../types";
import { FellowCard } from "./FellowCard";
import { InlineFilters } from "./InlineFilters";
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
  onViewPersonDetails?: (personId: string, context?: { peopleIds: string[]; label: string }) => void;
  /** Filters & setter so the sidebar can host inline quick-filters */
  filters?: Filters;
  onFiltersChange?: (f: Filters) => void;
  defaultYear?: number;
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
        paddingTopLeft: [paddingLeft, paddingTop],
        paddingBottomRight: [paddingRight, paddingBottom],
        maxZoom: 12,
        animate: false,
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

// Zoom to marker only when user selected from the list (sidebar), not when they clicked the map.
// Map clicks should just open the popup and keep current zoom.
function ZoomToMarker({
  marker,
  onlyWhenFromList,
}: {
  marker: MarkerData | null;
  onlyWhenFromList: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!marker || !onlyWhenFromList) return;
    const targetZoom = 8;
    const finalZoom = Math.max(targetZoom, 2.5);
    map.flyTo(
      [marker.coordinates.lat, marker.coordinates.lng],
      finalZoom,
      { duration: 0.5 }
    );
  }, [map, marker, onlyWhenFromList]);

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

const escapeHtml = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Build popup HTML for one marker (location + list of people). */
function buildPopupHtml(marker: MarkerData): string {
  const cityCountry = escapeHtml(`${marker.city}, ${marker.country}`);
  const n = marker.people.length;
  const peopleWord = n === 1 ? "person" : "people";
  const rows = marker.people
    .map(({ person, travelWindow }) => {
      const name = escapeHtml(person.fullName);
      const roleGradient = getRoleGradient(person.roleType);
      const roleStyle = `background:${roleGradient};color:#374151`;
      const alumni = person.isAlumni ? '<span class="text-[11px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-600 shrink-0">Alumni</span>' : "";
      const focusTags = person.focusTags
        .slice(0, 3)
        .map((tag) => `<span class="text-[11px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-700 shrink-0 max-w-[80px] truncate" title="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`)
        .join("");
      const travel =
        travelWindow &&
        `<span class="text-[11px] text-gray-500 shrink-0 truncate max-w-[90px]">${escapeHtml(
          `${new Date(travelWindow.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${new Date(travelWindow.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        )}</span>`;
      return `<button type="button" class="map-node-popup__person w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px] sm:min-h-[40px] flex flex-col justify-center gap-1 cursor-pointer" data-person-id="${escapeHtml(person.id)}">
        <span class="text-sm font-medium text-gray-900 truncate">${name}</span>
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-[11px] px-1.5 py-0.5 rounded font-medium shrink-0" style="${roleStyle}">${escapeHtml(person.roleType)}</span>
          ${alumni}
          ${focusTags}
          ${travel || ""}
        </div>
      </button>`;
    })
    .join("");
  return `<div class="map-node-popup__inner overflow-hidden bg-white">
    <div class="map-node-popup__header px-3 pt-2 pb-1.5 pr-10 border-b border-gray-100 shrink-0">
      <h4 class="font-semibold text-gray-900 text-sm leading-tight sm:text-base font-heading">${cityCountry}</h4>
      <p class="text-xs text-gray-500 mt-0.5 leading-snug">${n} ${peopleWord} — tap a name to see in list; use More details for full profile</p>
    </div>
    <div class="map-node-popup__list overflow-y-auto overscroll-contain pt-px min-h-0">${rows}</div>
  </div>`;
}

/**
 * Renders markers inside a Leaflet MarkerClusterGroup (imperative) so we get
 * clustering when zoomed out without relying on the broken React wrapper context.
 */
function ImperativeMarkerClusters({
  markers,
  foresightIcon,
  onMarkerClick,
  onPersonClick,
}: {
  markers: MarkerData[];
  foresightIcon: string;
  onMarkerClick: (marker: MarkerData) => void;
  onPersonClick: (personId: string) => void;
}) {
  const map = useMap();
  const onPersonClickRef = useRef(onPersonClick);
  onPersonClickRef.current = onPersonClick;

  useEffect(() => {
    if (!map || markers.length === 0) return;
    const ClusterGroup = (L as unknown as { markerClusterGroup: (o?: object) => L.LayerGroup }).markerClusterGroup;
    if (typeof ClusterGroup !== "function") return;

    type MarkerWithRoles = L.Marker & { __roleTypes?: Set<RoleType>; __markerData?: MarkerData };
    const group = ClusterGroup({
      maxClusterRadius: 70,
      zoomToBoundsOnClick: false, // We handle clusterclick ourselves so single-marker clusters open popup on first click
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction(cluster) {
        const allRoles = new Set<RoleType>();
        cluster.getAllChildMarkers().forEach((m) => {
          (m as MarkerWithRoles).__roleTypes?.forEach((t) => allRoles.add(t));
        });
        const count = cluster.getChildCount();
        const background = createRoleBasedBadgeBackground(allRoles);
        const roles = ROLE_ORDER.filter((r) => allRoles.has(r));
        const innerColor = roles.length ? ROLE_COLORS[roles[0]].end : "#6d28d9";
        const sizeClass = count < 10 ? "small" : count < 100 ? "medium" : "large";
        return L.divIcon({
          html: `<div class="marker-cluster-role-outer" style="background:${background};border:2px solid white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.2)"><div class="marker-cluster-role-inner" style="background:${innerColor};border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:12px">${count}</div></div>`,
          className: `marker-cluster marker-cluster-${sizeClass} marker-cluster-role`,
          iconSize: L.point(40, 40),
          iconAnchor: L.point(20, 20),
        });
      },
    });

    type ClusterLayer = L.Marker & {
      getChildCount(): number;
      getAllChildMarkers(): L.Marker[];
      _childClusters?: ClusterLayer[];
      _zoom?: number;
      _childCount?: number;
      spiderfy(): void;
      zoomToBounds(): void;
    };

    const MIN_ZOOM_ON_NODE_CLICK = 10;

    const handleClusterClick = (e: L.LeafletEvent & { layer: ClusterLayer }) => {
      const cluster = e.layer;
      const count = cluster.getChildCount();
      if (count === 1) {
        const child = cluster.getAllChildMarkers()[0] as MarkerWithRoles;
        const markerData = child?.__markerData;
        if (markerData) {
          const { lat, lng } = markerData.coordinates;
          const zoom = Math.max(MIN_ZOOM_ON_NODE_CLICK, map.getZoom());
          map.flyTo([lat, lng], zoom, { duration: 0.4 });
          (child as L.Marker).openPopup();
          onMarkerClick(markerData);
        }
        return;
      }
      let bottomCluster: ClusterLayer = cluster;
      while (bottomCluster._childClusters?.length === 1) {
        bottomCluster = bottomCluster._childClusters[0];
      }
      const maxZoom = map.getMaxZoom();
      if (
        bottomCluster._zoom === maxZoom &&
        bottomCluster._childCount === cluster.getChildCount()
      ) {
        cluster.spiderfy();
      } else {
        cluster.zoomToBounds();
      }
    };

    group.on("clusterclick", handleClusterClick);

    // Desktop: open popup on hover only when already zoomed in (no zoom on hover). Mobile: click only.
    const prefersHover = typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

    const openPopupOnClick = (m: L.Marker, data: MarkerData) => {
      const zoom = Math.max(MIN_ZOOM_ON_NODE_CLICK, map.getZoom());
      map.flyTo([data.coordinates.lat, data.coordinates.lng], zoom, { duration: 0.3 });
      m.openPopup();
      onMarkerClick(data);
    };

    const openPopupOnHover = (m: L.Marker, data: MarkerData) => {
      if (map.getZoom() < MIN_ZOOM_ON_NODE_CLICK) return;
      m.openPopup();
      onMarkerClick(data);
    };

    markers.forEach((marker) => {
      const roleTypes = new Set<RoleType>(marker.people.map((p) => p.person.roleType));
      const icon = createCustomIcon(marker.people.length, roleTypes, false, foresightIcon);
      const latLng: L.LatLngExpression = [marker.coordinates.lat, marker.coordinates.lng];
      const content = document.createElement("div");
      content.innerHTML = buildPopupHtml(marker);
      const leafletMarker = L.marker(latLng, { icon }).bindPopup(content, {
        className: "custom-popup map-node-popup",
        autoPan: true,
        autoPanPadding: L.point(24, 48),
        offset: L.point(0, 10),
      }) as MarkerWithRoles;
      leafletMarker.__roleTypes = roleTypes;
      leafletMarker.__markerData = marker;

      let closeTimeout: ReturnType<typeof setTimeout> | null = null;
      const scheduleClose = () => {
        closeTimeout = setTimeout(() => {
          leafletMarker.closePopup();
          closeTimeout = null;
        }, 280);
      };
      const cancelClose = () => {
        if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
        }
      };

      if (prefersHover) {
        leafletMarker.on("mouseover", () => openPopupOnHover(leafletMarker, marker));
        leafletMarker.on("mouseout", () => scheduleClose());
      }

      leafletMarker.on("click", () => {
        cancelClose();
        openPopupOnClick(leafletMarker, marker);
      });

      leafletMarker.on("popupopen", () => {
        const popupContent = leafletMarker.getPopup()?.getContent();
        if (popupContent && typeof popupContent !== "string") {
          const el = popupContent as HTMLElement;
          const handler = (e: Event) => {
            const target = (e.target as HTMLElement).closest("[data-person-id]");
            if (target) {
              const id = (target as HTMLElement).getAttribute("data-person-id");
              if (id) onPersonClickRef.current(id);
            }
          };
          el.addEventListener("click", handler);
          leafletMarker.once("popupclose", () => el.removeEventListener("click", handler));
        }
        if (prefersHover) {
          const popupEl = leafletMarker.getPopup()?.getElement();
          if (popupEl) {
            popupEl.addEventListener("mouseenter", cancelClose);
            popupEl.addEventListener("mouseleave", scheduleClose);
            leafletMarker.once("popupclose", () => {
              popupEl.removeEventListener("mouseenter", cancelClose);
              popupEl.removeEventListener("mouseleave", scheduleClose);
            });
          }
        }
      });
      group.addLayer(leafletMarker);
    });

    map.addLayer(group);
    return () => {
      group.off("clusterclick", handleClusterClick);
      map.removeLayer(group);
      group.clearLayers();
    };
  }, [map, markers, foresightIcon, onMarkerClick]);

  return null;
}


export function MapView({
  filteredPeople,
  filteredTravelWindows,
  timeWindowStart,
  timeWindowEnd,
  granularity = "Year",
  onViewPersonDetails,
  filters,
  onFiltersChange,
  defaultYear,
}: MapViewProps) {
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);
  /** When true, selection came from the list (sidebar); when false, from map click. Used so we only fly to marker when selecting from list. */
  const [selectedMarkerFromList, setSelectedMarkerFromList] = useState(false);
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

  // Reset selected marker when filtered results change so FitBounds re-runs
  useEffect(() => {
    setSelectedMarker(null);
    setSelectedMarkerFromList(false);
  }, [filteredPeople]);

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

  // People to show in sidebar: when a location is selected, only that location; otherwise all filtered.
  const sidebarPeople = useMemo(() => {
    if (selectedMarker) return selectedMarker.people.map((p) => p.person);
    return filteredPeople;
  }, [selectedMarker, filteredPeople]);

  const openSidebarAndScrollToPerson = (personId: string) => {
    setSelectedPerson(personId);
    setIsSidebarOpen(true);
    requestAnimationFrame(() => {
      const el = personRefs.current[personId];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const clearLocationSelection = () => {
    setSelectedMarker(null);
    setSelectedMarkerFromList(false);
    setSelectedPerson(null);
  };

  // Shared people list: card click = highlight + scroll; "More details" = open full profile modal.
  const peopleListContent = (
    <>
      {sidebarPeople.length === 0 ? (
        <p className="text-center text-gray-500 py-8 text-sm">
          {selectedMarker
            ? "No people at this location."
            : "No people match your filters. Try changing search, year, or filter options."}
        </p>
      ) : (
        sidebarPeople.map((person) => (
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
                const personMarker = markers.find((m) => m.people.some((p) => p.person.id === person.id));
                if (personMarker) {
                  setSelectedMarker(personMarker);
                  setSelectedMarkerFromList(true);
                }
                const navContext = selectedMarker
                  ? { peopleIds: sidebarPeople.map(p => p.id), label: `${selectedMarker.city}, ${selectedMarker.country}` }
                  : undefined;
                onViewPersonDetails?.(person.id, navContext);
              }}
              onHighlight={() => openSidebarAndScrollToPerson(person.id)}
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
            <ZoomToMarker marker={selectedMarker} onlyWhenFromList={selectedMarkerFromList} />
            <MapResizer isSidebarOpen={isSidebarOpen} />
            <ImperativeMarkerClusters
              markers={markers}
              foresightIcon={foresightIcon}
              onMarkerClick={(marker) => {
                setSelectedMarker(marker);
                setSelectedMarkerFromList(false);
                setSelectedPerson(null);
                if (!isMobile) setIsSidebarOpen(true);
              }}
              onPersonClick={(personId) => {
                setSelectedPerson(personId);
                setIsSidebarOpen(true);
                requestAnimationFrame(() => {
                  const el = personRefs.current[personId];
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
            />
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
        <div className="w-full lg:w-96 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col max-h-[500px] lg:max-h-none relative" style={{ zIndex: Z_INDEX_SIDEBAR }}>
          <div className="p-4 border-b border-gray-200 space-y-3 bg-app-sidebar">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-gray-900 font-semibold truncate font-heading">
                  {selectedMarker ? `${selectedMarker.city}, ${selectedMarker.country}` : "Fellows & Grantees"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedMarker ? `${sidebarPeople.length} at this location` : `${filteredPeople.length} people`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {selectedMarker && (
                  <button
                    type="button"
                    onClick={clearLocationSelection}
                    className="text-xs font-medium text-teal-600 hover:text-teal-700 px-2 py-1 rounded hover:bg-teal-50"
                  >
                    Show all
                  </button>
                )}
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900" onClick={() => setIsSidebarOpen(false)}>
                  Hide list
                </Button>
              </div>
            </div>
            {filters && onFiltersChange && defaultYear !== undefined && (
              <InlineFilters filters={filters} onFiltersChange={onFiltersChange} defaultYear={defaultYear} resultCount={sidebarPeople.length} />
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {peopleListContent}
          </div>
        </div>
      )}

      {/* Mobile: full-screen fellows sheet — below modals so detail modal appears on top */}
      {isMobile && isSidebarOpen && (
        <div className="fixed inset-0 bg-white flex flex-col shadow-2xl" style={{ zIndex: Z_INDEX_SIDEBAR }}>
          <div className="px-4 pt-4 pb-3 border-b border-gray-200 space-y-3 bg-app-sidebar">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-gray-900 text-lg font-semibold truncate font-heading">
                  {selectedMarker ? `${selectedMarker.city}, ${selectedMarker.country}` : "Fellows & Grantees"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedMarker ? `${sidebarPeople.length} at this location` : `${filteredPeople.length} people`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedMarker && (
                  <button
                    type="button"
                    onClick={clearLocationSelection}
                    className="text-xs font-medium text-teal-600 hover:text-teal-700 px-2 py-1.5 rounded hover:bg-teal-50"
                  >
                    Show all
                  </button>
                )}
                <Button variant="outline" size="sm" className="border-gray-300 text-gray-700 bg-white/80" onClick={() => setIsSidebarOpen(false)}>
                  Back to map
                </Button>
              </div>
            </div>
            {filters && onFiltersChange && defaultYear !== undefined && (
              <InlineFilters filters={filters} onFiltersChange={onFiltersChange} defaultYear={defaultYear} resultCount={sidebarPeople.length} />
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {peopleListContent}
          </div>
        </div>
      )}
    </div>
  );
}

