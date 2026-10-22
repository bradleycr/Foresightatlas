/**
 * Globe view.
 *
 * Same OpenStreetMap raster tiles as the Leaflet map, drawn on a sphere by
 * MapLibre. Zoomed out, the earth sits in the middle of the panel and a drag
 * spins it. Zoomed in, the projection eases back to a flat map, so streets
 * and colors match the atlas people already know.
 *
 * Pins are the same HTML as the flat map. They stand upright (they do not
 * smear across the curve) and fade out on the far side of the earth.
 *
 * Turn the whole view off with GLOBE_MAP_ENABLED in globeMapFlag.ts.
 */

import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
/*
 * Vite's dependency prebundler rewrites MapLibre's worker path and the file
 * is no longer next to the bundle. Point at the real worker before any map
 * is created, or the globe never paints.
 */
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

setWorkerUrl(maplibreWorkerUrl);
import { MaplibreStarfieldLayer } from "@geoql/maplibre-gl-starfield";
import { RoleType } from "../../types";
import { effectiveIsAlumni } from "../../utils/cohortLabel";
import {
  ROLE_CLUSTER_KEYS,
  bindPopupPeople,
  buildPopupHtml,
  buildShowcasePopupHtml,
  clusterBadgeHtml,
  communityStatusFromCounts,
  getCommunityStatus,
  locationPinHtml,
  rolesFromClusterFlags,
  type PinLocation,
} from "./pinAppearance";

/** Atlantic in the middle, matching the flat map's opening center. */
const GLOBE_HOME_CENTER: [number, number] = [0, 20];

/**
 * Idle globe spin — Mapbox’s rotating-globe pattern (easeTo loop).
 * No device sensors / permissions. Pauses on drag, stops when zoomed in.
 * ~3 minutes per revolution reads as “alive”, not a carnival ride.
 */
const SPIN_SECONDS_PER_REVOLUTION = 180;
/** Above this zoom the sphere is basically a flat map — stop spinning. */
const SPIN_MAX_ZOOM = 3.25;
/** Between this and SPIN_MAX_ZOOM, ease the spin to a halt. */
const SPIN_SLOW_ZOOM = 2.35;
/** First-load reveal: start a touch closer, ease out to home zoom. */
const INTRO_ZOOM_DELTA = 0.8;
const INTRO_DURATION_MS = 2400;

/**
 * Sphere diameter at a zoom is about (512 × 2^zoom) / π.
 * Size it to the panel so the earth stays large and still has a margin.
 */
function globeHomeZoom(width: number, height: number): number {
  const shorter = Math.min(width, height);
  if (shorter < 80) return 1.2;
  const targetDiameter = shorter * 0.78;
  const zoom = Math.log2((targetDiameter * Math.PI) / 512);
  return Math.max(0.95, Math.min(zoom, 2));
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Matches the Leaflet map: open the list instead of zooming when a cluster is one city. */
const CITY_CLUSTER_METERS = 22000;
const MIN_ZOOM_ON_PIN_CLICK = 10;
const MOBILE_FIT_MARKERS_THRESHOLD = 50;

interface GlobeMapProps {
  markers: PinLocation[];
  iconUrl: string;
  isMobile: boolean;
  skipIfMarkerSelected: boolean;
  selectedMarker: PinLocation | null;
  selectedMarkerFromList: boolean;
  /** Desktop sidebar hover — soft fly to this pin without selecting it. */
  previewMarker?: PinLocation | null;
  onMarkerClick: (marker: PinLocation) => void;
  onPersonClick: (personId: string) => void;
  /** WebGL or the style failed. The parent drops back to the flat map. */
  onUnavailable: () => void;
  /**
   * Public teaser: role-count popup only — never a name list.
   * Person clicks are ignored even if synthetic ids exist on the markers.
   */
  showcase?: boolean;
}

function pinFeatureCollection(markers: PinLocation[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: markers.map((marker, index) => {
      const roles = new Set(marker.people.map((entry) => entry.person.roleType));
      const properties: Record<string, number> = {
        markerIndex: index,
        personCount: marker.people.length,
        alumniCount: marker.people.filter((entry) => effectiveIsAlumni(entry.person)).length,
      };
      for (const { key, role } of ROLE_CLUSTER_KEYS) {
        properties[key] = roles.has(role) ? 1 : 0;
      }
      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [marker.coordinates.lng, marker.coordinates.lat],
        },
        properties,
      };
    }),
  };
}

function distanceMeters(latA: number, lngA: number, latB: number, lngB: number): number {
  const earth = 6371000;
  const dLat = ((latB - latA) * Math.PI) / 180;
  const dLng = ((lngB - lngA) * Math.PI) / 180;
  const a1 = (latA * Math.PI) / 180;
  const a2 = (latB * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a1) * Math.cos(a2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The fields we read off a clustered point. MapLibre's feature types carry extra internals we never use. */
interface ClusterLeaf {
  geometry: { type: string; coordinates: number[] };
  properties?: Record<string, unknown> | null;
}

function leafSpanMeters(leaves: ClusterLeaf[]): number {
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  let count = 0;
  for (const leaf of leaves) {
    if (leaf.geometry.type !== "Point") continue;
    const [lng, lat] = leaf.geometry.coordinates;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    count += 1;
  }
  if (count < 2) return 0;
  return distanceMeters(minLat, minLng, maxLat, maxLng);
}

export function GlobeMap({
  markers,
  iconUrl,
  isMobile,
  skipIfMarkerSelected,
  selectedMarker,
  selectedMarkerFromList,
  previewMarker = null,
  onMarkerClick,
  onPersonClick,
  onUnavailable,
  showcase = false,
}: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(markers);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onPersonClickRef = useRef(onPersonClick);
  const iconUrlRef = useRef(iconUrl);
  const showcaseRef = useRef(showcase);
  /** First-load intro owns framing until it finishes — marker effects must not snap over it. */
  const introCompleteRef = useRef(prefersReducedMotion());
  /** Stops the idle rAF spin before any programmatic easeTo/flyTo (avoids MapLibre ease races). */
  const stopIdleSpinRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);

  markersRef.current = markers;
  onMarkerClickRef.current = onMarkerClick;
  onPersonClickRef.current = onPersonClick;
  iconUrlRef.current = iconUrl;
  showcaseRef.current = showcase;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: MapLibreMap;
    const opening = container.getBoundingClientRect();
    const homeZoom = globeHomeZoom(opening.width, opening.height);
    const reduceMotion = prefersReducedMotion();
    const openingZoom = reduceMotion
      ? homeZoom
      : Math.min(homeZoom + INTRO_ZOOM_DELTA, 2.9);
    try {
      map = new MapLibreMap({
        container,
        center: GLOBE_HOME_CENTER,
        zoom: openingZoom,
        minZoom: 0.55,
        maxZoom: 18,
        attributionControl: false,
        dragRotate: true,
        pitchWithRotate: false,
        touchPitch: false,
        maxPitch: 0,
        renderWorldCopies: false,
        fadeDuration: 0,
        canvasContextAttributes: { antialias: true, alpha: true },
        style: {
          version: 8,
          projection: { type: "globe" },
          /*
           * Night around the sphere. The starfield layer paints over this.
           * fog-ground-blend is 0 so the dark sky never tints land or water.
           * The halo fades once the view flattens.
           */
          sky: {
            "sky-color": "#05070d",
            "horizon-color": "#121a2e",
            "fog-color": "#05070d",
            "sky-horizon-blend": 0.55,
            "horizon-fog-blend": 0.45,
            "fog-ground-blend": 0,
            "atmosphere-blend": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              0.55,
              4,
              0.4,
              6.5,
              0,
            ],
          },
          sources: {
            osm: {
              type: "raster",
              tiles: [
                "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              maxzoom: 19,
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Milky Way &copy; <a href="https://www.eso.org/public/images/eso0932a/">ESO/S. Brunier</a>',
            },
          },
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#aad3df" },
            },
            { id: "osm", type: "raster", source: "osm" },
          ],
        },
      });
    } catch {
      onUnavailable();
      return;
    }

    mapRef.current = map;

    const mountStarfield = () => {
      if (map.getLayer("atlas-starfield")) return;
      const before = map.getStyle()?.layers?.[0]?.id;
      map.addLayer(
        new MaplibreStarfieldLayer({
          id: "atlas-starfield",
          galaxyTextureUrl: `${import.meta.env.BASE_URL}milkyway.jpg`,
          galaxyBrightness: 0.55,
          starCount: 4500,
          starSize: 2.2,
          sunEnabled: false,
          autoFadeStars: false,
        }),
        before,
      );
    };
    map.on("load", mountStarfield);
    if (map.loaded() || map.isStyleLoaded()) mountStarfield();

    /* Public showcase is pinch/scroll only — chrome owns the corners. */
    if (!showcase) {
      map.addControl(
        new NavigationControl({ showCompass: false, visualizePitch: false }),
        /* Bottom-left with the projection toggle; legend sits above on desktop. */
        "bottom-left",
      );
    }
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");

    /*
     * Idle spin via requestAnimationFrame + jumpTo.
     * The Mapbox easeTo→moveend loop races MapLibre's camera stop() and can
     * throw "_onEaseFrame is not a function" mid-frame — rAF avoids that.
     */
    let userInteracting = false;
    /** True while a pin/cluster flyTo owns the camera — touchend must not restart spin mid-flight. */
    let programmaticCamera = false;
    /**
     * True from pin pointerdown through activate(). Mobile fires touchend
     * before click; without this the idle spin restarts and the cluster id
     * expires under the finger — first tap feels dead, flat map does not.
     */
    let pinGestureActive = false;
    let spinEnabled = !reduceMotion;
    let introRunning = false;
    let spinRaf = 0;
    let lastSpinTs = 0;

    const stopSpinLoop = () => {
      if (spinRaf) {
        cancelAnimationFrame(spinRaf);
        spinRaf = 0;
      }
      lastSpinTs = 0;
    };
    stopIdleSpinRef.current = stopSpinLoop;

    const tickSpin = (ts: number) => {
      spinRaf = 0;
      if (!spinEnabled || userInteracting || introRunning || programmaticCamera) return;
      const zoom = map.getZoom();
      if (zoom >= SPIN_MAX_ZOOM) return;

      let degreesPerSecond = 360 / SPIN_SECONDS_PER_REVOLUTION;
      if (zoom > SPIN_SLOW_ZOOM) {
        const t = (SPIN_MAX_ZOOM - zoom) / (SPIN_MAX_ZOOM - SPIN_SLOW_ZOOM);
        degreesPerSecond *= Math.max(0, t);
      }
      if (degreesPerSecond < 0.02) return;

      if (!lastSpinTs) lastSpinTs = ts;
      const dtSec = Math.min(0.05, (ts - lastSpinTs) / 1000);
      lastSpinTs = ts;

      const center = map.getCenter();
      center.lng -= degreesPerSecond * dtSec;
      map.jumpTo({ center });

      spinRaf = requestAnimationFrame(tickSpin);
    };

    const startSpinLoop = () => {
      if (!spinEnabled || userInteracting || introRunning || programmaticCamera || spinRaf) return;
      lastSpinTs = 0;
      spinRaf = requestAnimationFrame(tickSpin);
    };

    const pauseSpin = () => {
      userInteracting = true;
      stopSpinLoop();
      if (introRunning) {
        introRunning = false;
        introCompleteRef.current = true;
        try {
          map.stop();
        } catch {
          /* MapLibre can race stop() against an in-flight ease frame. */
        }
      }
    };
    const resumeSpin = () => {
      /* A pin fly-in or in-flight cluster tap still owns the camera. */
      if (programmaticCamera || pinGestureActive) return;
      userInteracting = false;
      startSpinLoop();
    };

    /** Fly/ease without the idle spin stomping the animation; run `after` on settle. */
    const runCameraMove = (move: () => void, after?: () => void) => {
      stopSpinLoop();
      userInteracting = true;
      pinGestureActive = false;
      programmaticCamera = true;
      map.once("moveend", () => {
        programmaticCamera = false;
        userInteracting = false;
        after?.();
        startSpinLoop();
      });
      move();
    };

    map.on("mousedown", pauseSpin);
    map.on("touchstart", pauseSpin);
    map.on("mouseup", resumeSpin);
    map.on("touchend", resumeSpin);
    map.on("dragend", resumeSpin);
    map.on("pitchend", resumeSpin);
    map.on("rotateend", resumeSpin);
    map.on("zoomend", resumeSpin);

    let introStarted = false;
    const startIntro = () => {
      if (introStarted) return;
      introStarted = true;
      if (reduceMotion) {
        introCompleteRef.current = true;
        startSpinLoop();
        return;
      }
      introRunning = true;
      const box = map.getContainer().getBoundingClientRect();
      const targetZoom = globeHomeZoom(box.width, box.height);
      map.easeTo({
        center: GLOBE_HOME_CENTER,
        zoom: targetZoom,
        duration: INTRO_DURATION_MS,
        easing: (t) => 1 - (1 - t) ** 2.4,
      });
      map.once("moveend", () => {
        if (!introRunning) return;
        introRunning = false;
        introCompleteRef.current = true;
        startSpinLoop();
      });
    };
    map.once("load", startIntro);
    if (map.loaded()) startIntro();

    const popup = new Popup({
      closeButton: true,
      closeOnClick: true,
      closeOnMove: false,
      /* Focusing the name button scrolls the page. The flat map does not do that. */
      focusAfterOpen: false,
      /* Room for the Leaflet-matching inset. The CSS sets the real width. */
      maxWidth: "364px",
      className: "map-node-popup atlas-globe-popup",
      anchor: "bottom",
      offset: [0, -52],
    });

    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    let holdUntil = 0;
    let openKey = "";
    const prefersHover =
      typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

    const cancelClose = () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    };
    const scheduleClose = () => {
      if (!prefersHover) return;
      cancelClose();
      const wait = Math.max(280, holdUntil - performance.now());
      closeTimer = setTimeout(() => {
        if (performance.now() < holdUntil) {
          scheduleClose();
          return;
        }
        popup.remove();
        closeTimer = null;
      }, wait);
    };

    const onPopupEnter = () => cancelClose();
    const onPopupLeave = () => scheduleClose();
    popup.on("open", () => {
      const element = popup.getElement();
      element?.addEventListener("mouseenter", onPopupEnter);
      element?.addEventListener("mouseleave", onPopupLeave);
    });
    popup.on("close", () => {
      openKey = "";
      const element = popup.getElement();
      element?.removeEventListener("mouseenter", onPopupEnter);
      element?.removeEventListener("mouseleave", onPopupLeave);
    });

    /*
     * Same idea as Leaflet's autoPan: if the card would be clipped by the
     * map's edge, slide the view just enough that the whole card sits inside
     * with a margin. The pin stays under the card.
     */
    const panPopupIntoView = (paddingY: number) => {
      const element = popup.getElement();
      if (!element) return;
      const mapRect = map.getContainer().getBoundingClientRect();
      const pop = element.getBoundingClientRect();
      const padX = 24;
      let dx = 0;
      let dy = 0;
      if (pop.right > mapRect.right - padX) dx = pop.right - (mapRect.right - padX);
      if (pop.left - dx < mapRect.left + padX) dx = pop.left - (mapRect.left + padX);
      if (pop.bottom > mapRect.bottom - paddingY) dy = pop.bottom - (mapRect.bottom - paddingY);
      if (pop.top - dy < mapRect.top + paddingY) dy = pop.top - (mapRect.top + paddingY);
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      map.panBy([dx, dy], { duration: 280 });
    };

    const openPopup = (lngLat: [number, number], location: PinLocation, clustered: boolean) => {
      const key = `${clustered ? "c" : "p"}:${lngLat[0].toFixed(4)},${lngLat[1].toFixed(4)}:${location.people.map((entry) => entry.person.id).join(",")}`;
      /* Hover fires often. Rebuild only when the card is for a different place. */
      if (openKey === key && popup.isOpen()) {
        cancelClose();
        return;
      }
      openKey = key;
      const root = document.createElement("div");
      if (showcaseRef.current) {
        root.innerHTML = buildShowcasePopupHtml(location);
      } else {
        root.innerHTML = buildPopupHtml(location);
        bindPopupPeople(root, (personId) => onPersonClickRef.current(personId));
      }
      popup.setOffset(clustered ? [0, -28] : [0, -52]);
      popup.setDOMContent(root).setLngLat(lngLat).addTo(map);
      /* The pan moves the pin out from under the cursor. Don't treat that as a leave. */
      holdUntil = performance.now() + 340;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => panPopupIntoView(clustered ? 64 : 48));
      });
    };

    const locationFromLeaves = (leaves: ClusterLeaf[]): PinLocation | null => {
      const sourceMarkers = markersRef.current;
      const people: PinLocation["people"] = [];
      const seen = new Set<string>();
      const cityCounts = new Map<string, { city: string; country: string; count: number }>();
      let lat = 0;
      let lng = 0;
      let count = 0;

      for (const leaf of leaves) {
        const index = Number(leaf.properties?.markerIndex);
        const marker = sourceMarkers[index];
        if (!marker) continue;
        for (const entry of marker.people) {
          if (seen.has(entry.person.id)) continue;
          seen.add(entry.person.id);
          people.push(entry);
        }
        const key = `${marker.city}|${marker.country}`;
        const previous = cityCounts.get(key);
        cityCounts.set(key, {
          city: marker.city,
          country: marker.country,
          count: (previous?.count ?? 0) + marker.people.length,
        });
        if (leaf.geometry.type === "Point") {
          lng += leaf.geometry.coordinates[0];
          lat += leaf.geometry.coordinates[1];
          count += 1;
        }
      }

      if (!people.length || count === 0) return null;
      let city = "Nearby";
      let country = "";
      let best = 0;
      for (const entry of cityCounts.values()) {
        if (entry.count > best) {
          best = entry.count;
          city = entry.city || "Nearby";
          country = entry.country;
        }
      }
      people.sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));
      return {
        city,
        country,
        coordinates: { lat: lat / count, lng: lng / count },
        people,
      };
    };

    const beginPinGesture = () => {
      pinGestureActive = true;
      userInteracting = true;
      stopSpinLoop();
    };

    const endPinGesture = () => {
      pinGestureActive = false;
      if (!programmaticCamera) {
        userInteracting = false;
        startSpinLoop();
      }
    };

    /**
     * Zoom until the cluster breaks apart — same idea as Leaflet
     * zoomToBounds. Prefer MapLibre’s expansion zoom; if the cluster id
     * expired mid-tap (common while the globe was spinning), fit the leaves.
     */
    const zoomToBreakCluster = async (
      source: GeoJSONSource,
      clusterId: number,
      lngLat: [number, number],
      leaves: ClusterLeaf[],
    ) => {
      let nextZoom: number | null = null;
      try {
        if (typeof source.getClusterExpansionZoom === "function") {
          nextZoom = await source.getClusterExpansionZoom(clusterId);
        }
      } catch {
        nextZoom = null;
      }

      if (nextZoom != null && Number.isFinite(nextZoom)) {
        const targetZoom = Math.max(nextZoom, map.getZoom() + 0.75);
        runCameraMove(() =>
          map.easeTo({
            center: lngLat,
            zoom: Math.min(targetZoom, 14),
            duration: 450,
            essential: true,
          }),
        );
        return;
      }

      const bounds = new LngLatBounds();
      for (const leaf of leaves) {
        if (leaf.geometry?.type !== "Point") continue;
        const coords = leaf.geometry.coordinates as [number, number];
        if (Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
          bounds.extend(coords);
        }
      }
      if (bounds.isEmpty()) {
        runCameraMove(() =>
          map.easeTo({
            center: lngLat,
            zoom: Math.min(map.getZoom() + 2.25, 14),
            duration: 450,
            essential: true,
          }),
        );
        return;
      }
      runCameraMove(() =>
        map.fitBounds(bounds, {
          padding: 56,
          maxZoom: 14,
          duration: 450,
          essential: true,
        }),
      );
    };

    const activate = async (element: HTMLElement, fromHover: boolean) => {
      const kind = element.dataset.kind;
      if (fromHover && (kind !== "point" || map.getZoom() < MIN_ZOOM_ON_PIN_CLICK)) return;
      cancelClose();
      if (!fromHover) beginPinGesture();

      if (kind === "point") {
        const location = markersRef.current[Number(element.dataset.markerIndex)];
        if (!location) {
          if (!fromHover) endPinGesture();
          return;
        }
        const lngLat: [number, number] = [location.coordinates.lng, location.coordinates.lat];
        if (!fromHover && map.getZoom() < MIN_ZOOM_ON_PIN_CLICK) {
          const zoomDelta = MIN_ZOOM_ON_PIN_CLICK - map.getZoom();
          const duration = Math.min(1100, Math.max(450, zoomDelta * 110));
          runCameraMove(
            () =>
              map.flyTo({
                center: lngLat,
                zoom: MIN_ZOOM_ON_PIN_CLICK,
                duration,
                essential: true,
              }),
            () => openPopup(lngLat, location, false),
          );
        } else {
          openPopup(lngLat, location, false);
          if (!fromHover) endPinGesture();
        }
        onMarkerClickRef.current(location);
        return;
      }

      if (fromHover || kind !== "cluster") {
        if (!fromHover) endPinGesture();
        return;
      }
      const source = map.getSource("atlas-people") as GeoJSONSource | undefined;
      if (!source || typeof source.getClusterLeaves !== "function") {
        endPinGesture();
        return;
      }
      const clusterId = Number(element.dataset.clusterId);
      const lngLat: [number, number] = [Number(element.dataset.lng), Number(element.dataset.lat)];
      try {
        const leaves = (await source.getClusterLeaves(clusterId, 1000, 0)) as ClusterLeaf[];
        const location = locationFromLeaves(leaves);
        if (!location) {
          endPinGesture();
          return;
        }
        const tight = leafSpanMeters(leaves) <= CITY_CLUSTER_METERS || map.getZoom() >= 12;
        if (tight) {
          /*
           * Same-city clusters used to open the card at globe zoom — spin
           * paused, nothing flew. Mirror a single-pin tap: zoom in, then card.
           */
          if (map.getZoom() < MIN_ZOOM_ON_PIN_CLICK) {
            const zoomDelta = MIN_ZOOM_ON_PIN_CLICK - map.getZoom();
            const duration = Math.min(1100, Math.max(450, zoomDelta * 110));
            runCameraMove(
              () =>
                map.flyTo({
                  center: lngLat,
                  zoom: MIN_ZOOM_ON_PIN_CLICK,
                  duration,
                  essential: true,
                }),
              () => openPopup(lngLat, location, true),
            );
          } else {
            openPopup(lngLat, location, true);
            endPinGesture();
          }
          onMarkerClickRef.current(location);
          return;
        }
        await zoomToBreakCluster(source, clusterId, lngLat, leaves);
      } catch {
        /*
         * Cluster expired (spin / concurrent move). Nudge in toward the
         * badge so the next tile rebuild is under the finger’s target.
         */
        if (Number.isFinite(lngLat[0]) && Number.isFinite(lngLat[1])) {
          runCameraMove(() =>
            map.easeTo({
              center: lngLat,
              zoom: Math.min(map.getZoom() + 2.25, 14),
              duration: 450,
              essential: true,
            }),
          );
        } else {
          endPinGesture();
        }
      }
    };

    const pins = new Map<string, { marker: Marker; signature: string }>();

    const renderElement = (properties: Record<string, unknown>, clustered: boolean) => {
      const element = document.createElement("div");
      element.className = "atlas-globe-pin";
      if (clustered) {
        const count = Number(properties.personCount) || Number(properties.point_count) || 0;
        element.innerHTML = clusterBadgeHtml({
          count,
          roleTypes: rolesFromClusterFlags(properties),
          communityStatus: communityStatusFromCounts(count, Number(properties.alumniCount) || 0),
        });
      } else {
        const marker = markersRef.current[Number(properties.markerIndex)];
        const people = marker?.people.map((entry) => entry.person) ?? [];
        const roleTypes = new Set<RoleType>(people.map((person) => person.roleType));
        element.innerHTML = locationPinHtml({
          count: people.length,
          roleTypes,
          communityStatus: getCommunityStatus(people),
          isSelected: false,
          iconUrl: iconUrlRef.current,
        });
      }
      return element;
    };

    /**
     * Rebuild HTML markers from the cluster index.
     *
     * `prune: false` while the camera is panning/spinning — mid-move
     * `querySourceFeatures` often returns a partial tile set, and deleting
     * “missing” pins makes Israel vanish into Europe then pop back. Markers
     * already track lng/lat themselves; we only need structural updates when
     * zoom changes or the map goes idle.
     */
    const syncPins = (options?: { prune?: boolean }) => {
      if (!map.getSource("atlas-people") || !map.isStyleLoaded()) return;
      const prune = options?.prune ?? true;
      let features: ClusterLeaf[] = [];
      try {
        features = map.querySourceFeatures("atlas-people") as ClusterLeaf[];
      } catch {
        return;
      }

      const seen = new Set<string>();
      for (const feature of features) {
        if (feature.geometry.type !== "Point") continue;
        const properties = (feature.properties ?? {}) as Record<string, unknown>;
        const clustered = Boolean(properties.cluster);
        const id = clustered ? `c:${properties.cluster_id}` : `p:${properties.markerIndex}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const coords = feature.geometry.coordinates as [number, number];
        const signature = clustered
          ? `c:${properties.personCount}:${properties.alumniCount}:${properties.fellow}:${properties.seniorFellow}:${properties.grantee}:${properties.prizeWinner}:${properties.nodee}:${properties.foresightTeam}`
          : `p:${properties.markerIndex}:${properties.personCount}:${properties.alumniCount}`;

        const existing = pins.get(id);
        if (existing && existing.signature === signature) {
          existing.marker.setLngLat(coords);
          const element = existing.marker.getElement();
          element.dataset.lng = String(coords[0]);
          element.dataset.lat = String(coords[1]);
          continue;
        }

        if (!prune && !existing) {
          /* Don't invent a new parent cluster from a half-loaded tile query. */
          continue;
        }

        existing?.marker.remove();
        const element = renderElement(properties, clustered);
        element.dataset.kind = clustered ? "cluster" : "point";
        element.dataset.markerIndex = String(properties.markerIndex ?? "");
        element.dataset.clusterId = String(properties.cluster_id ?? "");
        element.dataset.lng = String(coords[0]);
        element.dataset.lat = String(coords[1]);
        element.setAttribute(
          "aria-label",
          clustered
            ? `Cluster of ${Number(properties.personCount) || Number(properties.point_count) || 0} people — tap to zoom`
            : "Map pin",
        );

        const marker = new Marker({
          element,
          anchor: clustered ? "center" : "bottom",
          /* Far side of the earth disappears instead of showing a backwards pin. */
          opacityWhenCovered: 0,
          subpixelPositioning: true,
        })
          .setLngLat(coords)
          .addTo(map);

        /*
         * Capture pointerdown before map touchend resumes spin. Without this,
         * zoomed-out cluster taps often miss on the first try.
         */
        element.addEventListener(
          "pointerdown",
          (event) => {
            if (event.button != null && event.button !== 0) return;
            beginPinGesture();
            event.stopPropagation();
          },
          { capture: true },
        );
        marker.on("click", (event) => {
          event.originalEvent.stopPropagation();
          event.originalEvent.preventDefault();
          void activate(element, false);
        });
        element.addEventListener("mouseenter", () => void activate(element, true));
        element.addEventListener("mouseleave", scheduleClose);
        pins.set(id, { marker, signature });
      }

      if (!prune) return;

      for (const [id, entry] of pins) {
        if (seen.has(id)) continue;
        entry.marker.remove();
        pins.delete(id);
      }
    };

    let frame = 0;
    let pendingPrune = false;
    const requestSync = (prune = true) => {
      if (prune) pendingPrune = true;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const shouldPrune = pendingPrune;
        pendingPrune = false;
        syncPins({ prune: shouldPrune });
      });
    };

    const clearPins = () => {
      for (const entry of pins.values()) entry.marker.remove();
      pins.clear();
      popup.remove();
    };

    /*
     * An inline style can finish loading inside the constructor, before this
     * listener exists. `loaded()` catches that; the listener catches the
     * normal path. The guard keeps the source from being added twice.
     */
    const mountPeople = () => {
      if (map.getSource("atlas-people")) {
        requestSync();
        return;
      }
      try {
        map.addSource("atlas-people", {
          type: "geojson",
          data: pinFeatureCollection(markersRef.current),
          cluster: true,
          /*
           * Tighter than the flat map’s 70px. On a spinning globe a wide
           * radius makes Israel fold into Europe (and similar) as soon as
           * you aren’t staring straight at it — pins feel like they vanish.
           */
          clusterRadius: 42,
          clusterMaxZoom: 16,
          clusterProperties: {
            personCount: ["+", ["get", "personCount"]],
            alumniCount: ["+", ["get", "alumniCount"]],
            fellow: ["max", ["get", "fellow"]],
            seniorFellow: ["max", ["get", "seniorFellow"]],
            grantee: ["max", ["get", "grantee"]],
            prizeWinner: ["max", ["get", "prizeWinner"]],
            nodee: ["max", ["get", "nodee"]],
            foresightTeam: ["max", ["get", "foresightTeam"]],
          },
        });
        /*
         * Nothing is drawn here. MapLibre only builds cluster tiles for a
         * source that a layer is using, and the pins are HTML markers fed by
         * those tiles. A fully transparent circle keeps the tiles honest
         * without painting a second set of dots under the badges.
         */
        map.addLayer({
          id: "atlas-people-anchor",
          type: "circle",
          source: "atlas-people",
          paint: {
            "circle-radius": 0,
            "circle-opacity": 0,
          },
        });
        setReady(true);
        requestSync();
      } catch {
        /* A bad source should not take the flat map down with it. Tiles still show. */
      }
    };
    map.on("load", mountPeople);
    if (map.loaded() || map.isStyleLoaded()) mountPeople();

    /*
     * Zoom must rebuild clusters (split/merge). Pan/spin must not prune —
     * idle spin + drag used to call querySourceFeatures every frame and
     * delete pins that were only missing from a partial tile result.
     */
    map.on("zoom", () => requestSync(true));
    map.on("zoomend", () => requestSync(true));
    map.on("idle", () => requestSync(true));
    map.on("sourcedata", (event) => {
      if (event.sourceId !== "atlas-people") return;
      if (map.isMoving() && !map.isZooming()) {
        requestSync(false);
        return;
      }
      requestSync(true);
    });
    map.on("error", (event) => {
      const message = event.error?.message ?? "";
      if (/webgl|failed to initialize/i.test(message)) onUnavailable();
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    return () => {
      spinEnabled = false;
      introRunning = false;
      stopSpinLoop();
      stopIdleSpinRef.current = () => {};
      if (frame) cancelAnimationFrame(frame);
      cancelClose();
      resizeObserver.disconnect();
      clearPins();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    /* The map is created once. Marker data, clicks, and the icon flow in through refs. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const source = map.getSource("atlas-people") as GeoJSONSource | undefined;
    /*
     * `instanceof` is unreliable once Vite splits MapLibre into its own chunk.
     * A source with setData is the GeoJSON source we added.
     */
    if (!source || typeof source.setData !== "function") return;
    source.setData(pinFeatureCollection(markers));
  }, [markers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || skipIfMarkerSelected) return;

    const shouldFit =
      isMobile && markers.length > 0 && markers.length <= MOBILE_FIT_MARKERS_THRESHOLD;

    if (!shouldFit) {
      /*
       * While the opening zoom-out runs, leave framing alone. After that,
       * only snap home when the camera has left globe range (e.g. after a
       * pin fly-to) — filter refreshes should not yank the idle spin.
       */
      if (!introCompleteRef.current) return;
      if (map.getZoom() <= SPIN_MAX_ZOOM) return;
      stopIdleSpinRef.current();
      const opening = map.getContainer().getBoundingClientRect();
      map.easeTo({
        center: GLOBE_HOME_CENTER,
        zoom: globeHomeZoom(opening.width, opening.height),
        duration: 700,
      });
      return;
    }

    if (markers.length === 1) {
      const only = markers[0];
      map.jumpTo({
        center: [only.coordinates.lng, only.coordinates.lat],
        zoom: Math.min(10, 14),
      });
      return;
    }

    const bounds = new LngLatBounds();
    markers.forEach((marker) => bounds.extend([marker.coordinates.lng, marker.coordinates.lat]));
    map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
  }, [ready, markers, isMobile, skipIfMarkerSelected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedMarker || !selectedMarkerFromList) return;
    stopIdleSpinRef.current();
    map.flyTo({
      center: [selectedMarker.coordinates.lng, selectedMarker.coordinates.lat],
      zoom: Math.max(8, map.getZoom()),
      duration: 500,
    });
  }, [ready, selectedMarker, selectedMarkerFromList]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !previewMarker || isMobile) return;
    /* Don't fight a deliberate list click fly-to. */
    if (selectedMarkerFromList && selectedMarker) return;
    stopIdleSpinRef.current();
    const zoom = Math.max(map.getZoom(), 6.5);
    map.easeTo({
      center: [previewMarker.coordinates.lng, previewMarker.coordinates.lat],
      zoom,
      duration: 900,
      easing: (t) => 1 - (1 - t) ** 2.2,
    });
  }, [ready, previewMarker, isMobile, selectedMarker, selectedMarkerFromList]);

  return <div ref={containerRef} className="atlas-globe-map" />;
}
