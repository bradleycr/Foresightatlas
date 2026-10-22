/**
 * ConnectionsPage — bookmarked people, with Open to meet actions inline.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bookmark, Shield, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Identity } from "../services/identity";
import type { Person } from "../types";
import {
  fetchConnectionsFromAPI,
  getConnectionIds,
  removeConnection,
} from "../services/connections";
import { Button } from "../components/ui/button";
import { MeetActions, OpenToMeetBadge } from "../components/MeetActions";
import { getRolePillClass } from "../styles/roleColors";
import {
  connectionsAccentGradient,
  connectionsHeaderGradient,
} from "../styles/gradients";
import { isOpenToMeet } from "../utils/openToMeet";
import { buildFullPath } from "../utils/router";
import { cn } from "../components/ui/utils";

const connectionsHeaderStyle: React.CSSProperties = {
  background: `linear-gradient(to bottom, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.82) 100%), ${connectionsHeaderGradient}`,
  backgroundBlendMode: "normal",
};

export interface ConnectionsPageProps {
  identity: Identity | null;
  people: Person[];
  connectionsVersion?: number;
  onNavigateHome: () => void;
  onOpenProfile: () => void;
  onViewPerson: (personId: string) => void;
}

export function ConnectionsPage({
  identity,
  people,
  connectionsVersion = 0,
  onNavigateHome,
  onOpenProfile,
  onViewPerson,
}: ConnectionsPageProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!identity?.personId) return;
    void fetchConnectionsFromAPI(identity.personId).then(() => {
      setTick((t) => t + 1);
    });
  }, [identity?.personId, connectionsVersion]);

  const connectionIds = useMemo(
    () => (identity ? getConnectionIds(identity.personId) : []),
    [identity?.personId, tick, connectionsVersion],
  );

  const connectedPeople = useMemo(
    () => people.filter((p) => connectionIds.includes(p.id)),
    [people, connectionIds],
  );

  const openToMeetCount = useMemo(
    () => connectedPeople.filter(isOpenToMeet).length,
    [connectedPeople],
  );

  const unresolvedIds = useMemo(
    () => connectionIds.filter((id) => !people.some((p) => p.id === id)),
    [connectionIds, people],
  );

  const handleRemoveBookmark = (personId: string) => {
    if (!identity) return;
    const pending = removeConnection(identity.personId, personId);
    setTick((t) => t + 1);
    toast.message("Removed from connections", { duration: 1400 });
    void pending.catch((err) => {
      setTick((t) => t + 1);
      toast.error(
        err instanceof Error ? err.message : "Could not remove connection",
      );
    });
  };

  if (!identity) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-pink-50/40 via-gray-50 to-emerald-50/30">
        <div
          className="border-b border-gray-200 px-4 py-4 md:px-8 md:py-5"
          style={connectionsHeaderStyle}
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateHome}
              className="min-h-[44px] gap-2 pl-2 text-gray-700 touch-manipulation"
            >
              <ArrowLeft className="size-4 shrink-0" />
              Back
            </Button>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <div
            className="mb-6 w-fit rounded-full p-6"
            style={{ background: connectionsAccentGradient }}
          >
            <Bookmark className="size-12 text-gray-900" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Your connections</h2>
          <p className="mb-8 max-w-sm text-gray-600">
            Sign in to bookmark people you want to connect with and see them here.
          </p>
          <Button onClick={onOpenProfile} className="min-h-[48px] gap-2 px-6 touch-manipulation">
            <UserCircle2 className="size-4" />
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-pink-50/40 via-gray-50 to-emerald-50/30">
      <div
        className="border-b border-gray-200 px-4 py-4 md:px-8 md:py-5"
        style={connectionsHeaderStyle}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateHome}
              className="min-h-[44px] min-w-[44px] shrink-0 gap-2 text-gray-700 touch-manipulation"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="min-w-0">
              <h1 className="truncate font-heading text-lg font-semibold text-gray-900 md:text-xl">
                Connections
              </h1>
              {connectionIds.length > 0 ? (
                <p className="truncate text-sm text-gray-600">
                  {unresolvedIds.length > 0
                    ? `${connectedPeople.length} visible · ${unresolvedIds.length} unavailable`
                    : `${connectedPeople.length} saved`}
                  {openToMeetCount > 0
                    ? ` · ${openToMeetCount} open to meet`
                    : ""}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-auto px-4 py-6 pb-8 md:px-8 md:py-8">
        <div
          className="mx-auto mb-6 flex max-w-2xl gap-3 rounded-xl border border-gray-200/80 bg-white/70 px-4 py-3 text-sm leading-relaxed text-gray-600"
          role="note"
        >
          <Shield className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
          <p>
            <span className="font-medium text-gray-800">Private to you.</span>{" "}
            Bookmarks sync with your account. If someone is{" "}
            <span className="font-medium text-emerald-800">open to meet</span>, book or
            invite them right from this list — or browse everyone on{" "}
            <a
              href={buildFullPath("/open-to-meet")}
              className="font-medium text-emerald-800 underline-offset-2 hover:underline"
            >
              Open to meet
            </a>
            .
          </p>
        </div>

        {connectionIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-2 py-12 text-center sm:py-16">
            <div
              className="mb-6 w-fit rounded-full p-6"
              style={{ background: connectionsAccentGradient }}
            >
              <Bookmark className="size-12 text-gray-900" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">No connections yet</h2>
            <p className="max-w-sm text-gray-600">
              When you bookmark someone from their profile, they&apos;ll show up here so you
              can find them — and book them if they&apos;re open to meet.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-8">
            {connectedPeople.length > 0 ? (
              <ul className="space-y-3">
                {connectedPeople.map((person) => {
                  const open = isOpenToMeet(person);
                  return (
                    <li key={person.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onViewPerson(person.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onViewPerson(person.id);
                          }
                        }}
                        className={cn(
                          "flex flex-col gap-3 rounded-xl border bg-white p-4 sm:gap-4",
                          "border-gray-200 shadow-sm transition-colors",
                          open && "border-emerald-200/90 ring-1 ring-emerald-50",
                          "hover:border-gray-300 hover:bg-gray-50/80 hover:shadow-md active:bg-gray-100",
                          "min-h-[60px] cursor-pointer touch-manipulation sm:min-h-0",
                        )}
                      >
                        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="truncate font-medium text-gray-900">
                                {person.fullName}
                              </p>
                              {open ? <OpenToMeetBadge /> : null}
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                                  getRolePillClass(person.roleType),
                                )}
                              >
                                {person.roleType}
                              </span>
                            </div>
                            <p className="truncate text-sm text-gray-600">
                              {person.shortProjectTagline ||
                                person.affiliationOrInstitution ||
                                person.currentCity ||
                                "—"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleRemoveBookmark(person.id);
                            }}
                            className="-m-2 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-2.5 text-gray-900 transition-all touch-manipulation hover:opacity-90 active:scale-95 sm:m-0"
                            style={{ background: connectionsAccentGradient }}
                            aria-label={`Remove ${person.fullName} from connections`}
                          >
                            <Bookmark className="size-5 fill-current" />
                          </button>
                        </div>
                        <MeetActions person={person} compact />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {unresolvedIds.length > 0 ? (
              <section className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-amber-950">
                  Unavailable profiles ({unresolvedIds.length})
                </h2>
                <p className="mt-1 text-sm text-amber-900/80">
                  These bookmarks point to profiles that aren&apos;t visible in the directory
                  (private or removed). You can remove them to tidy your list.
                </p>
                <ul className="mt-4 space-y-2">
                  {unresolvedIds.map((id) => (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-amber-200/60 bg-white/80 px-3 py-2.5"
                    >
                      <span className="truncate text-sm text-gray-700">Profile unavailable</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBookmark(id)}
                        className="min-h-[44px] shrink-0 px-2 text-sm font-medium text-amber-950 underline-offset-2 touch-manipulation hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
