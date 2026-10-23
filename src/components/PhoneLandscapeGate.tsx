/**
 * Phones in landscape are a poor fit for this UI. On small touch devices
 * oriented sideways we blur the app and ask for portrait — tablets and
 * desktop keep working as usual.
 */

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { APP_NAME } from "../constants/foresight";
import { Z_INDEX_ORIENTATION_GATE } from "../constants/zIndex";

/**
 * Coarse pointer + short landscape viewport ≈ phone on its side.
 * Height 500px covers current iPhones; tablets in landscape sit well above it.
 */
const LANDSCAPE_PHONE_QUERY =
  "(orientation: landscape) and (max-height: 500px) and (pointer: coarse)";

function readMatches(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(LANDSCAPE_PHONE_QUERY).matches;
}

export function PhoneLandscapeGate() {
  const [blocked, setBlocked] = useState(readMatches);

  useEffect(() => {
    const mql = window.matchMedia(LANDSCAPE_PHONE_QUERY);
    const sync = () => setBlocked(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  if (!blocked) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="portrait-gate-title"
      aria-describedby="portrait-gate-body"
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{ zIndex: Z_INDEX_ORIENTATION_GATE }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-md"
      />
      <div className="relative max-w-sm rounded-3xl border border-white/20 bg-white/95 px-6 py-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <Smartphone
            className="size-7 rotate-90 transition-transform"
            aria-hidden
          />
        </div>
        <h2
          id="portrait-gate-title"
          className="font-heading text-lg font-semibold tracking-tight text-slate-900"
        >
          Rotate to portrait
        </h2>
        <p
          id="portrait-gate-body"
          className="mt-2 text-sm leading-relaxed text-slate-600"
        >
          Please turn your phone upright to enjoy {APP_NAME} in all of its
          magnificence.
        </p>
      </div>
    </div>
  );
}
