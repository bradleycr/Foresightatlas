import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import type { Person } from "../../types";
import { getDirectoryNames } from "../../services/database";
import { getLastSignedInName } from "../../services/identity";
import { setPostLoginReturnUrl } from "../../services/returnUrl";
import {
  ATLAS_PASSWORD_RESET_MAILTO,
  getCheckInAuthCopy,
  checkInReturnPath,
} from "../../utils/checkInAuth";
import { DirectoryLoginForm } from "./DirectoryLoginForm";
import foresightIcon from "../../assets/Foresight_RGB_Icon_Black.png?url";
import { FORESIGHT_ORG_URL } from "../../constants/foresight";

interface AuthGateProps {
  /** Current path (e.g. `/checkin/berlin`) — used for QR check-in context. */
  route: string;
  /** Authenticate a member; resolves with ok=false + message on failure. */
  onSignIn: (
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * AuthGate — the front door of the internal tool.
 *
 * The map, programming pages, profiles, and connections are all members-only,
 * so when there's no session this full-screen sign-in is the *only* thing that
 * renders. It loads just the name list (id + fullName) from the public
 * /api/directory-names endpoint so the picker can autocomplete without exposing
 * any of the gated directory data.
 */
export function AuthGate({ route, onSignIn }: AuthGateProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const checkInCopy = useMemo(() => getCheckInAuthCopy(route), [route]);

  useEffect(() => {
    const returnPath = checkInReturnPath(route);
    if (returnPath) setPostLoginReturnUrl(returnPath);
  }, [route]);

  useEffect(() => {
    let cancelled = false;
    // Autocomplete is a convenience, not a requirement — if the name list
    // fails to load, members can still type their full name and sign in.
    getDirectoryNames()
      .then((names) => {
        if (!cancelled) setPeople(names);
      })
      .catch(() => {
        if (!cancelled) setPeople([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 via-white to-sky-50 px-5 py-10">
      {/* Soft ambient glow so the card feels like it floats over the atlas. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-sky-200/30 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <div
            className={`flex size-16 items-center justify-center rounded-3xl border bg-white shadow-sm ${
              checkInCopy ? "border-sky-200" : "border-gray-200"
            }`}
          >
            {checkInCopy ? (
              <MapPin className="size-8 text-sky-600" aria-hidden />
            ) : (
              <a
                href={FORESIGHT_ORG_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-full items-center justify-center rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                aria-label="Foresight Institute — opens foresight.org in a new tab"
              >
                <img src={foresightIcon} alt="" className="size-9 object-contain" />
              </a>
            )}
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-gray-900">
            {checkInCopy ? checkInCopy.heroTitle : "Map · Programming · Nodes"}
          </h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-gray-600">
            {checkInCopy
              ? checkInCopy.heroSubtitle
              : "A private space for the Foresight community. Sign in to connect with grantees, fellows, nodees, and alumni."}
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-xl backdrop-blur-sm sm:p-7">
          <DirectoryLoginForm
            people={people}
            title={checkInCopy ? checkInCopy.formTitle : "Welcome back"}
            description={
              checkInCopy
                ? checkInCopy.formDescription
                : "Use your full name and password to enter."
            }
            submitLabel={checkInCopy ? checkInCopy.submitLabel : "Enter"}
            initialName={getLastSignedInName()}
            onSubmit={onSignIn}
            showAccountRecovery
          />
        </div>

        <p className="mt-5 text-center text-sm leading-6 text-gray-600">
          Forgot your password?{" "}
          <a
            href={ATLAS_PASSWORD_RESET_MAILTO}
            className="font-medium text-sky-600 transition-colors hover:text-sky-800"
          >
            Email for a reset link
          </a>
          {" "}— we'll send a personal link to set a new one.
        </p>

        <p className="mt-4 text-center text-xs leading-5 text-gray-400">
          Foresight Institute · Internal tool · Invitation only
        </p>
      </div>
    </main>
  );
}
