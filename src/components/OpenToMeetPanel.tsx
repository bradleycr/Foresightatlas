/**
 * OpenToMeetPanel — members who published a booking link.
 *
 * Search + simple affinity filters (connections / shared focus / shared city)
 * and paginated results. Used as the body of the Open to meet page.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import type { Person } from "../types";
import {
  filterOpenToMeetMembers,
  isOpenToMeet,
  type OpenToMeetFilter,
} from "../utils/openToMeet";
import { getEffectiveProfileImageUrl } from "../services/profileImageOverride";
import { PersonAvatar } from "./PersonAvatar";
import { MeetActions, OpenToMeetBadge } from "./MeetActions";
import { getRolePillClass } from "../styles/roleColors";
import { cn } from "./ui/utils";

const PAGE_SIZE = 12;

interface OpenToMeetPanelProps {
  people: Person[];
  viewer: Person | null;
  currentPersonId?: string | null;
  connectionIds?: string[];
  onViewPerson?: (personId: string) => void;
  className?: string;
  /** When true, omit the outer section chrome (page already has a header). */
  embedded?: boolean;
}

const FILTERS: { id: OpenToMeetFilter; label: string; needsViewer?: boolean }[] = [
  { id: "all", label: "All" },
  { id: "connections", label: "Connections" },
  { id: "focus", label: "Shares focus", needsViewer: true },
  { id: "city", label: "Shares city", needsViewer: true },
];

export function OpenToMeetPanel({
  people,
  viewer,
  currentPersonId,
  connectionIds = [],
  onViewPerson,
  className,
  embedded = false,
}: OpenToMeetPanelProps) {
  const [filter, setFilter] = useState<OpenToMeetFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () =>
      filterOpenToMeetMembers({
        people,
        viewer,
        connectionIds,
        filter,
        search,
      }),
    [people, viewer, connectionIds, filter, search],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageSlice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [filter, search]);

  const totalOpen = useMemo(() => people.filter(isOpenToMeet).length, [people]);

  const body = (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, city, focus…"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none ring-teal-500/25 placeholder:text-gray-400 focus:border-teal-300 focus:ring-2"
            aria-label="Search open to meet"
          />
        </div>
        <p className="shrink-0 text-xs tabular-nums text-gray-500 sm:text-right">
          {filtered.length === totalOpen
            ? `${totalOpen} open`
            : `${filtered.length} of ${totalOpen}`}
        </p>
      </div>

      {/*
        One horizontal row on every width — short labels + soft scroll if the
        viewport is narrow, so filters never stack into a second line.
      */}
      <div
        className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Filter open to meet"
      >
        {FILTERS.map((f) => {
          const disabled = Boolean(f.needsViewer && !viewer);
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              disabled={disabled}
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 min-h-[36px] rounded-full border px-3 text-xs font-medium transition-colors touch-manipulation sm:min-h-[40px] sm:px-3.5 sm:text-sm",
                active
                  ? "border-teal-700 bg-teal-700 text-white shadow-sm"
                  : "border-gray-200/90 bg-white/90 text-gray-700 hover:border-teal-300 hover:bg-teal-50/80",
                disabled && "cursor-not-allowed opacity-40 hover:border-gray-200 hover:bg-white",
              )}
              title={
                disabled
                  ? "Sign in with a profile to use this filter"
                  : undefined
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-teal-200/70 bg-white/60 px-4 py-5 text-sm leading-relaxed text-gray-600">
          {totalOpen === 0
            ? (
              <>
                No one has shared a booking link yet. Add an{" "}
                <span className="font-medium text-gray-800">open to meet link</span> on your
                profile (Calendly, Google appointment schedule, etc.) to appear here.
              </>
            )
            : "No matches for this filter. Try All, or clear the search."}
        </p>
      ) : (
        <>
          <ul className="mt-5 space-y-2">
            {pageSlice.map((person) => {
              const isSelf = currentPersonId === person.id;
              const isConnection = connectionIds.includes(person.id);
              return (
                <li key={person.id}>
                  <div
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border bg-white/90 p-3.5 sm:flex-row sm:items-center sm:gap-4",
                      isSelf ? "border-teal-300 ring-1 ring-teal-100" : "border-gray-200/90",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {onViewPerson ? (
                        <button
                          type="button"
                          onClick={() => onViewPerson(person.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                        >
                          <PersonAvatar
                            name={person.fullName}
                            src={getEffectiveProfileImageUrl(person)}
                            className="size-11 shrink-0 rounded-full ring-1 ring-gray-200/80"
                            textClassName="text-xs"
                          />
                          <MemberMeta
                            person={person}
                            isSelf={isSelf}
                            isConnection={isConnection && !isSelf}
                          />
                        </button>
                      ) : (
                        <>
                          <PersonAvatar
                            name={person.fullName}
                            src={getEffectiveProfileImageUrl(person)}
                            className="size-11 shrink-0 rounded-full ring-1 ring-gray-200/80"
                            textClassName="text-xs"
                          />
                          <MemberMeta
                            person={person}
                            isSelf={isSelf}
                            isConnection={isConnection && !isSelf}
                          />
                        </>
                      )}
                    </div>
                    {!isSelf ? <MeetActions person={person} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {pageCount > 1 ? (
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 disabled:opacity-40 touch-manipulation"
              >
                <ChevronLeft className="size-4" aria-hidden />
                Prev
              </button>
              <p className="text-xs tabular-nums text-gray-500">
                {safePage + 1} / {pageCount}
              </p>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 disabled:opacity-40 touch-manipulation"
              >
                Next
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );

  if (embedded) {
    return <div className={className}>{body}</div>;
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-teal-200/70 bg-gradient-to-br from-teal-50/70 via-white to-sky-50/50 p-5 shadow-sm sm:p-6",
        className,
      )}
      aria-labelledby="open-to-meet-heading"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-teal-200/60">
          <Users className="size-5 text-teal-700" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="open-to-meet-heading" className="text-lg font-semibold text-gray-900">
            Open to meet
          </h2>
          <p className="mt-0.5 text-sm text-gray-600">
            Book a slot with members who published a Calendly or appointment link.
          </p>
        </div>
      </div>
      {body}
    </section>
  );
}

function MemberMeta({
  person,
  isSelf,
  isConnection,
}: {
  person: Person;
  isSelf: boolean;
  isConnection?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="truncate font-medium text-gray-900">{person.fullName}</p>
        {isSelf ? (
          <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800">
            You
          </span>
        ) : null}
        {isConnection ? (
          <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-800">
            Connection
          </span>
        ) : null}
        <OpenToMeetBadge />
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
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
  );
}
