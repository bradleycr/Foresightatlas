/**
 * Open to meet page (route: /open-to-meet, legacy /calendar).
 *
 * Directory of members who published a booking link — not a shared
 * community Google Calendar. Node programming events stay on Berlin / SF / Global.
 */

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Users } from "lucide-react";
import type { Identity } from "../services/identity";
import type { Person } from "../types";
import { OpenToMeetPanel } from "../components/OpenToMeetPanel";
import { Button } from "../components/ui/button";
import { fetchConnectionsFromAPI, getConnectionIds } from "../services/connections";
import { buildFullPath } from "../utils/router";

interface CalendarPageProps {
  identity: Identity | null;
  signedInPerson: Person | null;
  people: Person[];
  onOpenProfile: () => void;
  onViewPerson?: (personId: string) => void;
}

export function CalendarPage({
  identity,
  signedInPerson,
  people,
  onOpenProfile,
  onViewPerson,
}: CalendarPageProps) {
  const [connectionsTick, setConnectionsTick] = useState(0);
  useEffect(() => {
    if (!identity?.personId) return;
    void fetchConnectionsFromAPI(identity.personId).then(() => {
      setConnectionsTick((t) => t + 1);
    });
  }, [identity?.personId]);

  const connectionIds = useMemo(
    () => (identity ? getConnectionIds(identity.personId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick refreshes after API sync
    [identity?.personId, connectionsTick],
  );

  if (!identity) {
    return (
      <div className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
          <Users className="mx-auto mb-4 size-8 text-teal-600" />
          <h1
            className="text-xl font-semibold text-gray-900"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Open to meet
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to browse members with booking links and filter by connections,
            shared focus, or city.
          </p>
          <Button className="mt-6" onClick={onOpenProfile}>
            Open profile sign-in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-auto"
      style={{
        /* Cooler teal→sky wash — keeps the “meet” green identity without the lawn. */
        background:
          "linear-gradient(165deg, rgba(204,251,241,0.45) 0%, rgba(249,250,251,0.96) 48%, rgba(224,242,254,0.4) 100%)",
      }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-6 rounded-2xl border border-teal-200/70 bg-white/90 p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-sky-50 ring-1 ring-teal-200/70">
              <CalendarDays className="size-5 text-teal-700" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1
                className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Open to meet
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
                Book time with people who published a Calendly or appointment link.
                Prefer someone you already know? Filter to{" "}
                <span className="font-medium text-gray-800">Connections</span>, or
                people who share your focus areas or city. Save people from their
                profile, then book them from{" "}
                <a
                  href={buildFullPath("/connections")}
                  className="font-medium text-teal-800 underline-offset-2 hover:underline"
                >
                  Connections
                </a>
                .
              </p>
            </div>
          </div>
        </header>

        <OpenToMeetPanel
          people={people}
          viewer={signedInPerson}
          currentPersonId={signedInPerson?.id ?? identity.personId}
          connectionIds={connectionIds}
          onViewPerson={onViewPerson}
          embedded
          className="rounded-2xl border border-teal-200/70 bg-gradient-to-br from-teal-50/70 via-white to-sky-50/50 p-5 shadow-sm sm:p-6"
        />
      </div>
    </div>
  );
}
