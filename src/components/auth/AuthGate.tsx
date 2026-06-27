import { useEffect, useState } from "react";
import type { Person } from "../../types";
import { getDirectoryNames } from "../../services/database";
import { getLastSignedInName } from "../../services/identity";
import { DirectoryLoginForm } from "./DirectoryLoginForm";
import foresightIcon from "../../assets/Foresight_RGB_Icon_Black.png?url";

interface AuthGateProps {
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
export function AuthGate({ onSignIn }: AuthGateProps) {
  const [people, setPeople] = useState<Person[]>([]);

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
          <div className="flex size-16 items-center justify-center rounded-3xl border border-gray-200 bg-white shadow-sm">
            <img src={foresightIcon} alt="Foresight Institute" className="size-9 object-contain" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-gray-900">
            Map · Programming · Nodes
          </h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-gray-600">
            A private space for Foresight fellows. Sign in to connect with
            grantees, fellows and nodees.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-xl backdrop-blur-sm sm:p-7">
          <DirectoryLoginForm
            people={people}
            title="Welcome back"
            description="Use your full name and password to enter."
            submitLabel="Enter"
            initialName={getLastSignedInName()}
            onSubmit={onSignIn}
          />
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-gray-400">
          Foresight Institute · Internal tool · Invitation only
        </p>
      </div>
    </main>
  );
}
