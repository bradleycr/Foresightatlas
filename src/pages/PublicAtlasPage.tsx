/**
 * Logged-out home — a spinning globe of aggregate pins from a static snapshot.
 *
 * No live directory API. public/data/atlas-preview.json ships city/role counts
 * only; refresh with `pnpm preview:atlas` whenever the roster moves.
 */

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, LogIn, X } from "lucide-react";
import foresightIcon from "../assets/Foresight_RGB_Icon_Black.png?url";
import foresightLogo from "../assets/Foresight_RGB_Logo_Black.png?url";
import { DirectoryLoginForm } from "../components/auth/DirectoryLoginForm";
import { useIsMobile } from "../components/ui/use-mobile";
import type { PinLocation } from "../components/map/pinAppearance";
import { FORESIGHT_LUMA_URL, FORESIGHT_ORG_URL } from "../constants/foresight";
import { getDirectoryNames } from "../services/database";
import { getLastSignedInName } from "../services/identity";
import type { Person, RoleType } from "../types";

const GlobeMap = lazy(() =>
  import("../components/map/GlobeMap").then((mod) => ({ default: mod.GlobeMap })),
);

interface AtlasPreviewPin {
  city: string;
  country: string;
  lat: number;
  lng: number;
  total: number;
  alumni: number;
  byRole: Partial<Record<RoleType, number>>;
}

interface AtlasPreviewFile {
  generatedAt?: string;
  personCount: number;
  pinCount: number;
  pins: AtlasPreviewPin[];
}

interface PublicAtlasPageProps {
  onSignIn: (
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}

const ROLE_ORDER: RoleType[] = [
  "Fellow",
  "Senior Fellow",
  "Grantee",
  "Prize Winner",
  "Nodee",
  "Foresight Team",
];

/** Expand aggregate counts into anonymous stand-ins for pin badges only. */
function pinsToMarkers(pins: AtlasPreviewPin[]): PinLocation[] {
  return pins.map((pin, pinIndex) => {
    const people: PinLocation["people"] = [];
    let alumniLeft = Math.max(0, Math.min(pin.alumni, pin.total));
    let slot = 0;

    for (const role of ROLE_ORDER) {
      const n = Number(pin.byRole?.[role] || 0);
      for (let i = 0; i < n; i += 1) {
        const isAlumni = alumniLeft > 0;
        if (isAlumni) alumniLeft -= 1;
        people.push({
          person: {
            id: `preview-${pinIndex}-${slot}`,
            fullName: "",
            roleType: role,
            fellowshipCohortYear: 0,
            fellowshipEndYear: isAlumni ? 2020 : null,
            affiliationOrInstitution: null,
            focusTags: [],
            currentCity: pin.city,
            currentCountry: pin.country,
            currentCoordinates: { lat: pin.lat, lng: pin.lng },
            primaryNode: "Global",
            profileUrl: "",
            profileImageUrl: null,
            contactUrlOrHandle: null,
            shortProjectTagline: "",
            expandedProjectDescription: "",
            isAlumni,
          },
        });
        slot += 1;
      }
    }

    // Guard against a malformed snapshot where byRole sums below total.
    while (people.length < pin.total) {
      const isAlumni = alumniLeft > 0;
      if (isAlumni) alumniLeft -= 1;
      people.push({
        person: {
          id: `preview-${pinIndex}-${slot}`,
          fullName: "",
          roleType: "Fellow",
          fellowshipCohortYear: 0,
          fellowshipEndYear: isAlumni ? 2020 : null,
          affiliationOrInstitution: null,
          focusTags: [],
          currentCity: pin.city,
          currentCountry: pin.country,
          currentCoordinates: { lat: pin.lat, lng: pin.lng },
          primaryNode: "Global",
          profileUrl: "",
          profileImageUrl: null,
          contactUrlOrHandle: null,
          shortProjectTagline: "",
          expandedProjectDescription: "",
          isAlumni,
        },
      });
      slot += 1;
    }

    return {
      city: pin.city,
      country: pin.country,
      coordinates: { lat: pin.lat, lng: pin.lng },
      people,
    };
  });
}

/** e.g. "Last update October 22, 2026" */
function formatLastUpdate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const when = d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `Last update ${when}`;
}

export function PublicAtlasPage({ onSignIn }: PublicAtlasPageProps) {
  const isMobile = useIsMobile();
  const [preview, setPreview] = useState<AtlasPreviewFile | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [globeFailed, setGlobeFailed] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [nameList, setNameList] = useState<Person[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/atlas-preview.json`, { cache: "no-cache" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as AtlasPreviewFile;
      })
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showLogin) return;
    let cancelled = false;
    getDirectoryNames()
      .then((names) => {
        if (!cancelled) setNameList(names);
      })
      .catch(() => {
        if (!cancelled) setNameList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [showLogin]);

  const markers = useMemo(
    () => (preview?.pins?.length ? pinsToMarkers(preview.pins) : []),
    [preview],
  );

  const lastUpdate = formatLastUpdate(preview?.generatedAt);

  return (
    <main className="relative h-[100svh] w-full overflow-hidden bg-[#0b1220] sm:h-[100dvh]">
      {!globeFailed && markers.length > 0 ? (
        <Suspense fallback={<div className="absolute inset-0 bg-[#0b1220]" />}>
          <GlobeMap
            markers={markers}
            iconUrl={foresightIcon}
            isMobile={isMobile}
            skipIfMarkerSelected={false}
            selectedMarker={null}
            selectedMarkerFromList={false}
            onMarkerClick={() => {}}
            onPersonClick={() => {}}
            onUnavailable={() => setGlobeFailed(true)}
            showcase
          />
        </Suspense>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-900 via-slate-800 to-sky-950 px-6 text-center">
          {loadError ? (
            <p className="max-w-sm text-sm text-slate-300">
              The public atlas snapshot isn&rsquo;t available right now. Sign in to
              open the full directory.
            </p>
          ) : !preview ? (
            <Loader2 className="size-8 animate-spin text-sky-300/80" aria-label="Loading" />
          ) : (
            <p className="max-w-sm text-sm text-slate-300">
              {preview.personCount.toLocaleString()} members across{" "}
              {preview.pinCount.toLocaleString()} places — sign in to explore the
              full atlas.
            </p>
          )}
        </div>
      )}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/50 via-black/20 to-transparent"
      />

      {/*
        Three-up chrome: Foresight wordmark left, Atlas title center, actions right.
        Absolute center title so it stays true-center regardless of side widths.
      */}
      <header className="absolute inset-x-0 top-0 z-20 p-3 sm:p-5">
        <div className="relative flex items-start justify-between gap-2">
          <a
            href={FORESIGHT_ORG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 flex shrink-0 items-center rounded-xl border border-white/15 bg-black/35 px-2.5 py-2 shadow-lg backdrop-blur-md transition hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:px-3 sm:py-2.5"
            aria-label="Foresight Institute — opens foresight.org in a new tab"
          >
            <img
              src={foresightLogo}
              alt=""
              className="h-7 w-auto brightness-0 invert sm:h-8 md:h-9"
            />
          </a>

          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-16 sm:px-28">
            <div className="max-w-[min(100%,16rem)] rounded-2xl border border-white/15 bg-black/35 px-3 py-2 text-center shadow-lg backdrop-blur-md sm:max-w-none sm:px-5 sm:py-2.5">
              <p className="text-sm font-semibold tracking-tight text-white sm:text-base">
                The Foresight Atlas
              </p>
              {lastUpdate ? (
                <p className="mt-0.5 text-[11px] text-white/65 sm:text-xs">{lastUpdate}</p>
              ) : null}
            </div>
          </div>

          <div className="relative z-10 flex shrink-0 flex-col items-stretch gap-2 sm:flex-row">
            <a
              href={FORESIGHT_LUMA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3.5 text-sm font-medium text-white shadow-lg backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <CalendarDays className="size-4 shrink-0 opacity-90" aria-hidden />
              Events
            </a>
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white px-3.5 text-sm font-semibold text-gray-900 shadow-lg transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <LogIn className="size-4 shrink-0" aria-hidden />
              <span className="sm:hidden">Sign in</span>
              <span className="hidden sm:inline">Community sign-in</span>
            </button>
          </div>
        </div>
      </header>

      {showLogin ? (
        <div
          className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Community sign-in"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowLogin(false)}
              className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              aria-label="Close sign-in"
            >
              <X className="size-5" />
            </button>
            <div className="mb-5 flex flex-col items-center text-center pr-6">
              <img src={foresightIcon} alt="" className="size-10 object-contain" />
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-gray-900">
                Welcome back
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Members see names, profiles, and programming.
              </p>
            </div>
            <DirectoryLoginForm
              people={nameList}
              title="Sign in"
              submitLabel="Enter"
              initialName={getLastSignedInName()}
              onSubmit={onSignIn}
              showAccountRecovery
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
