/**
 * StatsPage — community engagement totals from the portal.
 *
 * Nanowheels (◎) = check-ins at a node + RSVPs marked "going".
 * Data comes from the CheckIns and RSVPs Google Sheet tabs via GET /api/community-stats.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, MapPin, RefreshCw, Users } from "lucide-react";
import type { Identity } from "../services/identity";
import {
  fetchCommunityStats,
  type CommunityStats,
  type NodeCommunityStats,
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
              Community pulse
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              Nanowheels &amp; engagement
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
              Live totals from the atlas — every check-in at a node and every
              &ldquo;going&rdquo; RSVP earns one nanowheel (◎). Updated from the
              Google Sheet as people use the portal.
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

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TotalCard
                label="Total nanowheels"
                value={stats.totals.nanowheels}
                hint="Check-ins + going RSVPs"
                showBadge
              />
              <TotalCard
                label="Unique people"
                value={stats.totals.uniqueParticipants}
                hint="At least one check-in or RSVP"
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
            </section>

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
