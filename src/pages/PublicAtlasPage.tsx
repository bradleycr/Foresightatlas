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
import { MapRoleLegend } from "../components/map/MapRoleLegend";
import { useIsMobile } from "../components/ui/use-mobile";
import type { PinLocation } from "../components/map/pinAppearance";
import { APP_NAME, FORESIGHT_LUMA_URL, FORESIGHT_ORG_URL } from "../constants/foresight";
import { Z_INDEX_MODAL_BACKDROP, Z_INDEX_MODAL_CONTENT } from "../constants/zIndex";
import { getLastSignedInName } from "../services/identity";
import type { RoleType } from "../types";

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
  /** Open the short privacy notice (SPA navigate from signed-out home). */
  onOpenPrivacy?: () => void;
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

export function PublicAtlasPage({ onSignIn, onOpenPrivacy }: PublicAtlasPageProps) {
  const isMobile = useIsMobile();
  const [preview, setPreview] = useState<AtlasPreviewFile | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [globeFailed, setGlobeFailed] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

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

  const markers = useMemo(
    () => (preview?.pins?.length ? pinsToMarkers(preview.pins) : []),
    [preview],
  );

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

      {/* Soft vignettes so chrome stays readable over the globe */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/55 via-black/20 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/60 via-black/25 to-transparent"
      />

      {/* Logged-out only — legend stays off the signed-in map */}
      <MapRoleLegend tone="dark" surface="public" />

      {/*
        Three equal columns: product name · institute mark · Events.
        Logo sits bare on the sky — no glass frame — so it reads as the brand.
      */}
      <header className="absolute inset-x-0 top-0 z-20 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
        <div className="grid grid-cols-3 items-center gap-2 sm:gap-4">
          <div className="justify-self-start">
            <div className="flex flex-nowrap items-center gap-x-1.5 sm:gap-x-2">
              <p className="whitespace-nowrap text-[13px] font-semibold leading-none tracking-tight text-white sm:text-lg md:text-xl">
                {APP_NAME}
              </p>
              <span
                className="inline-flex shrink-0 items-center rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80 backdrop-blur-md"
                aria-label="Beta — this app is still in development"
              >
                Beta
              </span>
            </div>
          </div>

          <a
            href={FORESIGHT_ORG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="justify-self-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Foresight Institute — opens foresight.org in a new tab"
          >
            <img
              src={foresightLogo}
              alt=""
              className="h-11 w-auto brightness-0 invert drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:h-12 md:h-14"
            />
          </a>

          <div className="justify-self-end">
            <a
              href={FORESIGHT_LUMA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-sm font-medium text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl transition duration-200 hover:border-white/35 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:min-h-11 sm:gap-2 sm:px-4"
            >
              <CalendarDays className="size-3.5 shrink-0 opacity-90 sm:size-4" aria-hidden />
              Events
            </a>
          </div>
        </div>
      </header>

      {/* Thumb-zone CTA — glass, matching Events; centered above attribution */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[max(4.75rem,12vh)] z-20 flex justify-center px-4 sm:bottom-[max(5.5rem,14vh)]">
        <button
          type="button"
          onClick={() => setShowLogin(true)}
          className="pointer-events-auto inline-flex min-h-12 min-w-[11.5rem] items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-7 text-base font-semibold text-white shadow-[0_16px_48px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl transition duration-200 hover:border-white/40 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:min-h-11 sm:min-w-[13rem] sm:px-8"
        >
          <LogIn className="size-4 shrink-0 opacity-90" aria-hidden />
          Sign in
        </button>
      </div>

      {showLogin ? (
        <div
          className="fixed inset-0 flex items-end justify-center bg-black/50 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
          style={{ zIndex: Z_INDEX_MODAL_BACKDROP }}
          role="dialog"
          aria-modal="true"
          aria-label="Community sign-in"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-7"
            style={{ zIndex: Z_INDEX_MODAL_CONTENT }}
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
              title="Sign in"
              submitLabel="Enter"
              initialName={getLastSignedInName()}
              onSubmit={onSignIn}
              showAccountRecovery
            />
            {onOpenPrivacy ? (
              <p className="mt-4 text-center text-[11px] leading-none text-gray-400">
                <button
                  type="button"
                  onClick={onOpenPrivacy}
                  className="underline-offset-2 hover:text-gray-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2 rounded-sm"
                >
                  Privacy &amp; data
                </button>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
