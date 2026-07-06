/**
 * StatsPage — community engagement totals from the portal.
 *
 * Nanowheels (◎) = check-ins at a node + RSVPs marked "going".
 * Roster counts come from RealData; engagement from CheckIns + RSVPs + Events tabs.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  MapPin,
  Plane,
  RefreshCw,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import type { Identity } from "../services/identity";
import {
  fetchCommunityStats,
  type CommunityStats,
  type NodeCommunityStats,
  type RosterStats,
  type TopParticipantStat,
} from "../services/communityStats";
import { NanowheelBadge } from "../components/NanowheelBadge";
import { Button } from "../components/ui/button";

interface StatsPageProps {
  identity: Identity | null;
  onNavigateHome: () => void;
}

export function StatsPage({ identity, onNavigateHome }: StatsPageProps) {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!identity?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCommunityStats(identity.token);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load stats.");
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity?.token]);

  const maxMonthly = useMemo(() => {
    if (!stats?.monthly.length) return 1;
    return Math.max(1, ...stats.monthly.map((m) => m.nanowheels));
  }, [stats]);

  const updatedLabel = stats
    ? new Date(stats.generatedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-b from-slate-50 via-white to-sky-50/40">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <button
          type="button"
          onClick={onNavigateHome}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg py-2 pr-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 touch-manipulation"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to map
        </button>

        <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
              Admin · not in navigation
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              Nanowheels &amp; engagement
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
              Live totals from the Google Sheet — roster, check-ins, RSVPs, and
              upcoming events. Reach this page directly at{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-800">/stats</code>
              ; it is not linked anywhere in the app.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="min-h-[44px] shrink-0 gap-2 self-start sm:self-auto"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </Button>
        </header>

        {loading && !stats ? (
          <div className="mt-12 flex items-center justify-center gap-3 text-gray-600">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Loading community stats…
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        {stats ? (
          <div className="mt-8 space-y-10">
            {updatedLabel ? (
              <p className="text-xs text-gray-500">Last updated {updatedLabel}</p>
            ) : null}

            <ThisMonthBanner month={stats.thisMonth} />

            <section>
              <h2 className="text-lg font-semibold text-gray-900">Engagement totals</h2>
              <p className="mt-1 text-sm text-gray-600">
                Nanowheels = check-ins plus &ldquo;going&rdquo; RSVPs.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <TotalCard
                  label="Total nanowheels"
                  value={stats.totals.nanowheels}
                  hint="Check-ins + going RSVPs"
                  showBadge
                />
                <TotalCard
                  label="Unique people"
                  value={stats.totals.uniqueParticipants}
                  hint="At least one check-in or going RSVP"
                  icon={<Users className="size-5 text-violet-600" />}
                />
                <TotalCard
                  label="Check-ins"
                  value={stats.totals.checkIns}
                  hint="Node table & QR check-in"
                  icon={<MapPin className="size-5 text-sky-600" />}
                />
                <TotalCard
                  label="Going RSVPs"
                  value={stats.totals.rsvpsGoing}
                  hint="Events & coworking days"
                  icon={<span className="text-lg leading-none">◎</span>}
                />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <TotalCard
                  label="Interested RSVPs"
                  value={stats.totals.rsvpsInterested}
                  hint="Marked interested (not going yet)"
                  icon={<Sparkles className="size-5 text-amber-600" />}
                />
                <TotalCard
                  label="Upcoming events"
                  value={stats.totals.upcomingEvents}
                  hint="On the Events tab, end date not passed"
                  icon={<CalendarDays className="size-5 text-emerald-600" />}
                />
                <TotalCard
                  label="Going · upcoming"
                  value={stats.totals.upcomingGoingRsvps}
                  hint="Going RSVPs for future events"
                  icon={<CalendarDays className="size-5 text-teal-600" />}
                />
                <TotalCard
                  label="Active travel"
                  value={stats.totals.activeTravelWindows}
                  hint="Travel windows ending today or later"
                  icon={<Plane className="size-5 text-indigo-600" />}
                />
              </div>
            </section>

            <ActivitySnapshot stats={stats} />

            <RosterSection roster={stats.roster} />

            <section>
              <h2 className="text-lg font-semibold text-gray-900">By node</h2>
              <p className="mt-1 text-sm text-gray-600">
                Berlin, San Francisco, and global programming each get their own
                column. Coworking counts are RSVPs to coworking / resident-day
                events.
              </p>
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {stats.byNode.map((node) => (
                  <NodeStatsCard key={node.nodeSlug} node={node} />
                ))}
              </div>
            </section>

            {stats.monthly.length > 0 ? (
              <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="text-lg font-semibold text-gray-900">Over time</h2>
                <p className="mt-1 text-sm text-gray-600">
                  New nanowheels per month (check-in date or first RSVP month).
                </p>
                <ul className="mt-6 space-y-3">
                  {stats.monthly.map((row) => (
                    <li key={row.month} className="flex items-center gap-3">
                      <span className="w-14 shrink-0 text-xs font-medium tabular-nums text-gray-500">
                        {formatMonth(row.month)}
                      </span>
                      <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all"
                          style={{
                            width: `${Math.max(4, (row.nanowheels / maxMonthly) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-20 shrink-0 text-right text-sm tabular-nums text-gray-800">
                        {row.nanowheels}{" "}
                        <span className="text-xs text-gray-500">
                          ({row.checkIns}c · {row.rsvpsGoing}r)
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {stats.topParticipants.length > 0 ? (
              <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="text-lg font-semibold text-gray-900">Most engaged</h2>
                <p className="mt-1 text-sm text-gray-600">
                  People with the most nanowheels (check-ins + going RSVPs).
                </p>
                <ul className="mt-5 divide-y divide-gray-100">
                  {stats.topParticipants.map((person, index) => (
                    <TopParticipantRow key={person.personId} rank={index + 1} person={person} />
                  ))}
                </ul>
              </section>
            ) : null}

            {stats.topEvents.length > 0 ? (
              <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="text-lg font-semibold text-gray-900">Top events</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Events with the most &ldquo;going&rdquo; RSVPs right now.
                </p>
                <ul className="mt-5 divide-y divide-gray-100">
                  {stats.topEvents.map((ev) => (
                    <li
                      key={ev.eventId}
                      className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{ev.title}</p>
                        <p className="text-xs text-gray-500">
                          {nodeLabel(ev.nodeSlug)}
                          {ev.isCoworking ? " · Coworking" : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm tabular-nums text-gray-700">
                        {ev.going} going
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ThisMonthBanner({ month }: { month: CommunityStats["thisMonth"] }) {
  return (
    <section className="rounded-[1.75rem] border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-emerald-50/60 p-6 shadow-sm sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
        {formatMonth(month.month)}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-6">
        <div>
          <p className="text-sm text-gray-600">Nanowheels this month</p>
          <div className="mt-1 flex items-center gap-2">
            <NanowheelBadge
              count={month.nanowheels}
              size="lg"
              ariaLabel={`${month.nanowheels} nanowheels this month`}
            />
          </div>
        </div>
        <div>
          <p className="text-sm text-gray-600">Check-ins</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
            {month.checkIns.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Going RSVPs</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
            {month.rsvpsGoing.toLocaleString()}
          </p>
        </div>
      </div>
    </section>
  );
}

function ActivitySnapshot({ stats }: { stats: CommunityStats }) {
  return (
    <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-semibold text-gray-900">Activity snapshot</h2>
      <p className="mt-1 text-sm text-gray-600">Derived from the same sheet rows as above.</p>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SnapshotItem
          label="Check-ins · 30 days"
          value={stats.activity.checkInsLast30Days}
        />
        <SnapshotItem
          label="Avg nanowheels / person"
          value={stats.activity.avgNanowheelsPerParticipant}
          decimal
        />
        <SnapshotItem label="Events with RSVPs" value={stats.totals.eventsWithGoing} />
        <SnapshotItem label="Coworking RSVPs" value={stats.totals.coworkingEngagements} />
      </dl>
    </section>
  );
}

function SnapshotItem({
  label,
  value,
  decimal,
}: {
  label: string;
  value: number;
  decimal?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
        {decimal ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value.toLocaleString()}
      </dd>
    </div>
  );
}

function RosterSection({ roster }: { roster: RosterStats }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900">Directory</h2>
      <p className="mt-1 text-sm text-gray-600">
        Roster from RealData — who is in the atlas and how complete profiles are.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TotalCard
          label="People in roster"
          value={roster.total}
          hint={`${roster.publicProfiles} visible on the map`}
          icon={<Users className="size-5 text-gray-700" />}
        />
        <TotalCard
          label="Claimed accounts"
          value={roster.claimed}
          hint={`${roster.unclaimed} not claimed yet`}
          icon={<UserCheck className="size-5 text-emerald-600" />}
        />
        <TotalCard
          label="On the map"
          value={roster.onMap}
          hint={`${roster.withoutLocation} missing city / coords`}
          icon={<MapPin className="size-5 text-sky-600" />}
        />
        <TotalCard
          label="Open to meet"
          value={roster.openToMeet}
          hint="Availability link on profile"
          icon={<Sparkles className="size-5 text-violet-600" />}
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TotalCard label="Current" value={roster.current} hint="Active cohort / fellows" />
        <TotalCard label="Alumni" value={roster.alumni} hint="From sheet flag or end year" />
        <TotalCard
          label="With photo"
          value={roster.withPhoto}
          hint="profileImageUrl on RealData"
        />
        <TotalCard
          label="With contact"
          value={roster.withContact}
          hint="Email, handle, or calendar email"
        />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {roster.byPrimaryNode.map((node) => (
          <div
            key={node.nodeSlug}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {node.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
              {node.count.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">primary node on profile</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TopParticipantRow({ rank, person }: { rank: number; person: TopParticipantStat }) {
  return (
    <li className="flex items-center gap-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold tabular-nums text-gray-700">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900">{person.fullName}</p>
        <p className="text-xs text-gray-500">
          {person.checkIns} check-in{person.checkIns === 1 ? "" : "s"} · {person.rsvpsGoing} going
        </p>
      </div>
      <NanowheelBadge
        count={person.nanowheels}
        size="sm"
        ariaLabel={`${person.nanowheels} nanowheels for ${person.fullName}`}
      />
    </li>
  );
}

function TotalCard({
  label,
  value,
  hint,
  showBadge,
  icon,
}: {
  label: string;
  value: number;
  hint: string;
  showBadge?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        {showBadge ? (
          <NanowheelBadge count={value} size="lg" ariaLabel={`${value} total nanowheels`} />
        ) : (
          <>
            {icon ? <span aria-hidden>{icon}</span> : null}
            <span className="text-3xl font-semibold tabular-nums tracking-tight text-gray-900">
              {value.toLocaleString()}
            </span>
          </>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">{hint}</p>
    </div>
  );
}

function NodeStatsCard({ node }: { node: NodeCommunityStats }) {
  const accent =
    node.nodeSlug === "berlin"
      ? "from-amber-50 to-orange-50 border-amber-200/80"
      : node.nodeSlug === "sf"
        ? "from-indigo-50 to-rose-50 border-indigo-200/80"
        : "from-sky-50 to-violet-50 border-sky-200/80";

  return (
    <article
      className={`rounded-2xl border bg-gradient-to-br p-5 shadow-sm ${accent}`}
    >
      <h3 className="text-base font-semibold text-gray-900">{node.label}</h3>
      <div className="mt-4 flex items-center gap-2">
        <NanowheelBadge
          count={node.nanowheels}
          size="md"
          ariaLabel={`${node.nanowheels} nanowheels at ${node.label}`}
        />
        <span className="text-sm text-gray-600">nanowheels</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-gray-500">Check-ins</dt>
          <dd className="font-semibold tabular-nums text-gray-900">{node.checkIns}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Going RSVPs</dt>
          <dd className="font-semibold tabular-nums text-gray-900">{node.rsvpsGoing}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Coworking RSVPs</dt>
          <dd className="font-semibold tabular-nums text-gray-900">
            {node.coworkingEngagements}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Unique people</dt>
          <dd className="font-semibold tabular-nums text-gray-900">
            {node.uniqueParticipants}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function nodeLabel(slug: string): string {
  if (slug === "berlin") return "Berlin Node";
  if (slug === "sf") return "SF Node";
  return "Global";
}
