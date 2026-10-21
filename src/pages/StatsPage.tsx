/**
 * StatsPage — visual community pulse for Foresight Team.
 * Numbers and charts first; almost no prose.
 */

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  Download,
  Link2,
  Loader2,
  Lock,
  MapPin,
  RefreshCw,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Identity } from "../services/identity";
import {
  downloadClaimReminderCsv,
  fetchCommunityStats,
  type CommunityStats,
  type NodeCommunityStats,
} from "../services/communityStats";
import { NanowheelBadge } from "../components/NanowheelBadge";
import { Button } from "../components/ui/button";

const SKY = "#0ea5e9";
const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const VIOLET = "#8b5cf6";
const SLATE = "#64748b";
const ROSE = "#f43f5e";
const INDIGO = "#6366f1";

const CONTINENT_COLORS = [SKY, EMERALD, AMBER, VIOLET, ROSE, INDIGO, SLATE];

interface StatsPageProps {
  identity: Identity | null;
  onNavigateHome: () => void;
}

export function StatsPage({ identity, onNavigateHome }: StatsPageProps) {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = async () => {
    if (!identity?.token) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await fetchCommunityStats(identity.token);
      setStats(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not load stats.";
      setForbidden(/team only/i.test(msg) || /403/.test(msg));
      setError(msg);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity?.token]);

  const claimPct = useMemo(() => {
    if (!stats) return 0;
    const t = stats.claims.claimed + stats.claims.unclaimed;
    return t > 0 ? Math.round((stats.claims.claimed / t) * 100) : 0;
  }, [stats]);

  const rsvpPie = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Atlas", value: stats.rsvpSources.atlas, color: SKY },
      { name: "Luma", value: stats.rsvpSources.luma, color: AMBER },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const continentPie = useMemo(() => {
    if (!stats?.geography.continents.length) return [];
    return stats.geography.continents.map((c, i) => ({
      name: c.name,
      value: c.count,
      color: CONTINENT_COLORS[i % CONTINENT_COLORS.length],
    }));
  }, [stats]);

  const monthlyChart = useMemo(() => {
    if (!stats?.monthly.length) return [];
    return stats.monthly.slice(-8).map((m) => ({
      label: formatMonthShort(m.month),
      nanowheels: m.nanowheels,
      checkIns: m.checkIns,
      rsvps: m.rsvpsGoing,
    }));
  }, [stats]);

  const nodeCheckInBars = useMemo(() => {
    if (!stats) return [];
    return stats.checkIns.byNode
      .filter((n) => n.nodeSlug !== "global" || n.allTime > 0)
      .map((n) => ({
        name: n.nodeSlug === "berlin" ? "Berlin" : n.nodeSlug === "sf" ? "SF" : "Global",
        "7d": n.last7Days,
        "30d": n.last30Days,
      }));
  }, [stats]);

  if (!identity?.token) {
    return (
      <Shell onNavigateHome={onNavigateHome}>
        <EmptyState
          icon={<Lock className="size-6 text-sky-600" />}
          title="Sign in required"
        />
      </Shell>
    );
  }

  return (
    <Shell onNavigateHome={onNavigateHome} onRefresh={() => void load()} loading={loading}>
      {loading && !stats ? (
        <div className="mt-16 flex items-center justify-center gap-3 text-gray-500">
          <Loader2 className="size-5 animate-spin" aria-hidden />
        </div>
      ) : null}

      {forbidden ? (
        <EmptyState
          icon={<Lock className="size-6 text-amber-600" />}
          title="Foresight Team only"
        />
      ) : null}

      {error && !forbidden ? (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {stats ? (
        <div className="mt-6 space-y-6 pb-16">
          {/* Pulse hero */}
          <section className="relative overflow-hidden rounded-[1.75rem] border border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-emerald-50/70 p-6 sm:p-8">
            <div
              className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-sky-200/30 blur-3xl"
              aria-hidden
            />
            <div className="relative flex flex-wrap items-end justify-between gap-6">
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Community pulse
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <NanowheelBadge
                    count={stats.totals.nanowheels}
                    size="lg"
                    ariaLabel={`${stats.totals.nanowheels} nanowheels`}
                  />
                  <div>
                    <p
                      className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {stats.totals.nanowheels.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">nanowheels · all time</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 sm:gap-6">
                <HeroStat label="This month" value={stats.thisMonth.nanowheels} />
                <HeroStat label="People" value={stats.totals.uniqueParticipants} />
                <HeroStat label="Travel" value={stats.totals.activeTravelWindows} />
              </div>
            </div>
          </section>

          {/* Claim + connections + usage */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel className="lg:col-span-1">
              <PanelLabel>Claims</PanelLabel>
              <div className="mt-4 flex items-center gap-5">
                <Ring percent={claimPct} color={EMERALD} />
                <div className="min-w-0 space-y-1">
                  <BigNum value={stats.claims.claimed} />
                  <p className="text-xs text-gray-500">
                    of {(stats.claims.claimed + stats.claims.unclaimed).toLocaleString()} ·{" "}
                    {stats.claims.claimedLast30Days} new / 30d
                  </p>
                  <p className="text-xs text-amber-700">
                    {stats.claims.unclaimedWithEmail} unclaimed w/ email
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-5 min-h-[44px] w-full gap-2"
                disabled={stats.claims.reminderList.length === 0}
                onClick={() => downloadClaimReminderCsv(stats.claims.reminderList)}
              >
                <Download className="size-4" aria-hidden />
                Reminder CSV
              </Button>
            </Panel>

            <Panel>
              <PanelLabel>Logins</PanelLabel>
              {stats.logins && stats.logins.totalEvents > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniStat label="Today" value={stats.logins.logins.today} />
                  <MiniStat label="7 days" value={stats.logins.logins.last7Days} />
                  <MiniStat label="30 days" value={stats.logins.logins.last30Days} />
                  <MiniStat label="All time" value={stats.logins.logins.allTime} />
                </div>
              ) : (
                <p className="mt-6 text-sm text-gray-500">
                  Tracking from now — sign-ins will appear here.
                </p>
              )}
            </Panel>

            <Panel>
              <PanelLabel>Connections</PanelLabel>
              <div className="mt-4 flex items-end gap-3">
                <Link2 className="mb-1 size-5 text-violet-600" aria-hidden />
                <BigNum value={stats.connections.activeEdges} />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                unique pairs · {stats.connections.activeBookmarks} bookmarks
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MiniStat label="Check-ins 7d" value={stats.checkIns.last7Days} />
                <MiniStat label="Check-ins 30d" value={stats.checkIns.last30Days} />
              </div>
            </Panel>
          </div>

          {/* Geography + RSVP source */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelLabel>Geography</PanelLabel>
              <div className="mt-2 flex h-48 items-center gap-4">
                {continentPie.length > 0 ? (
                  <>
                    <div className="h-full min-w-0 flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={continentPie}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="55%"
                            outerRadius="80%"
                            paddingAngle={2}
                            strokeWidth={0}
                          >
                            {continentPie.map((d) => (
                              <Cell key={d.name} fill={d.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: number) => [v.toLocaleString(), "people"]}
                            contentStyle={tooltipStyle}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="w-28 shrink-0 space-y-1.5 text-xs">
                      {continentPie.slice(0, 5).map((d) => (
                        <li key={d.name} className="flex items-center gap-2">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: d.color }}
                          />
                          <span className="truncate text-gray-600">{d.name}</span>
                          <span className="ml-auto tabular-nums text-gray-900">{d.value}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No country pins yet.</p>
                )}
              </div>
              {stats.geography.countries.length > 0 ? (
                <ul className="mt-2 space-y-1.5 border-t border-gray-100 pt-3">
                  {stats.geography.countries.slice(0, 5).map((c) => (
                    <BarRow
                      key={c.name}
                      label={c.name}
                      value={c.count}
                      max={stats.geography.countries[0]?.count || 1}
                      color={SKY}
                    />
                  ))}
                </ul>
              ) : null}
            </Panel>

            <Panel>
              <PanelLabel>RSVPs · Atlas vs Luma</PanelLabel>
              <div className="mt-2 flex h-48 items-center gap-4">
                {rsvpPie.length > 0 ? (
                  <>
                    <div className="h-full min-w-0 flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={rsvpPie}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="55%"
                            outerRadius="80%"
                            paddingAngle={3}
                            strokeWidth={0}
                          >
                            {rsvpPie.map((d) => (
                              <Cell key={d.name} fill={d.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: number) => [v.toLocaleString(), "going"]}
                            contentStyle={tooltipStyle}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-28 shrink-0 space-y-3">
                      {rsvpPie.map((d) => (
                        <div key={d.name}>
                          <p className="text-xs text-gray-500">{d.name}</p>
                          <p className="text-xl font-semibold tabular-nums text-gray-900">
                            {d.value.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No going RSVPs yet.</p>
                )}
              </div>
            </Panel>
          </div>

          {/* Node check-ins + monthly */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelLabel>Node check-ins</PanelLabel>
              <div className="mt-4 h-52">
                {nodeCheckInBars.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={nodeCheckInBars} barGap={4}>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="7d" name="7 days" fill={SKY} radius={[6, 6, 0, 0]} />
                      <Bar dataKey="30d" name="30 days" fill={EMERALD} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500">No check-ins yet.</p>
                )}
              </div>
            </Panel>

            <Panel>
              <PanelLabel>Nanowheels over time</PanelLabel>
              <div className="mt-4 h-52">
                {monthlyChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyChart}>
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar
                        dataKey="nanowheels"
                        name="Nanowheels"
                        fill={SKY}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500">No monthly data yet.</p>
                )}
              </div>
            </Panel>
          </div>

          {/* Roster strip + nodes */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StripStat
              icon={<Users className="size-4 text-gray-600" />}
              label="Roster"
              value={stats.roster.total}
            />
            <StripStat
              icon={<UserCheck className="size-4 text-emerald-600" />}
              label="Claimed"
              value={stats.roster.claimed}
            />
            <StripStat
              icon={<MapPin className="size-4 text-sky-600" />}
              label="On map"
              value={stats.roster.onMap}
            />
            <StripStat
              icon={<Users className="size-4 text-violet-600" />}
              label="Open to meet"
              value={stats.roster.openToMeet}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {stats.byNode.map((node) => (
              <NodeCard key={node.nodeSlug} node={node} />
            ))}
          </div>

          {/* Tops — compact */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelLabel>Most engaged</PanelLabel>
              <ul className="mt-3 space-y-2">
                {stats.topParticipants.slice(0, 6).map((p, i) => (
                  <li key={p.personId} className="flex items-center gap-3">
                    <span className="w-5 text-xs tabular-nums text-gray-400">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                      {p.fullName}
                    </span>
                    <NanowheelBadge
                      count={p.nanowheels}
                      size="sm"
                      ariaLabel={`${p.nanowheels} for ${p.fullName}`}
                    />
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel>
              <PanelLabel>Top events</PanelLabel>
              <ul className="mt-3 space-y-2">
                {stats.topEvents.slice(0, 6).map((ev) => (
                  <li key={ev.eventId} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                      {ev.title}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-gray-600">
                      {ev.going}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {/* Visits — not recoverable */}
          <Panel className="border-dashed border-gray-300 bg-gray-50/60">
            <PanelLabel>Site visits</PanelLabel>
            <p className="mt-3 text-sm text-gray-600">
              Vercel Web Analytics was never enabled — no historical visits to recover.
              Analytics is wired in the app; turn it on in the Vercel project to start counting.
            </p>
          </Panel>
        </div>
      ) : null}
    </Shell>
  );
}

const tooltipStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
};

function Shell({
  children,
  onNavigateHome,
  onRefresh,
  loading,
}: {
  children: ReactNode;
  onNavigateHome: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}) {
  return (
    <div className="flex-1 overflow-auto bg-gradient-to-b from-slate-50 via-white to-sky-50/50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg py-2 pr-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 touch-manipulation"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Map
          </button>
          {onRefresh ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="min-h-[44px] gap-2"
              aria-label="Refresh stats"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            </Button>
          ) : null}
        </div>
        <h1
          className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Atlas stats
        </h1>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="mt-16 flex flex-col items-center gap-3 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200">
        {icon}
      </div>
      <p
        className="text-lg text-gray-800"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {title}
      </p>
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[1.5rem] border border-gray-200/90 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function PanelLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
      {children}
    </p>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-gray-900">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function BigNum({ value }: { value: number }) {
  return (
    <p className="text-3xl font-semibold tabular-nums tracking-tight text-gray-900">
      {value.toLocaleString()}
    </p>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-gray-900">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function StripStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200/90 bg-white px-4 py-3 shadow-sm">
      <span aria-hidden>{icon}</span>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-gray-900">
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function Ring({ percent, color }: { percent: number; color: string }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <div className="relative size-24 shrink-0">
      <svg viewBox="0 0 88 88" className="size-full -rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums text-gray-900">
        {percent}%
      </span>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.max(6, (value / Math.max(1, max)) * 100);
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 truncate text-gray-600">{label}</span>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums text-gray-800">{value}</span>
    </li>
  );
}

function NodeCard({ node }: { node: NodeCommunityStats }) {
  const accent =
    node.nodeSlug === "berlin"
      ? "from-amber-50 to-orange-50/80 border-amber-200/70"
      : node.nodeSlug === "sf"
        ? "from-indigo-50 to-rose-50/70 border-indigo-200/70"
        : "from-sky-50 to-violet-50/70 border-sky-200/70";

  return (
    <article className={`rounded-[1.5rem] border bg-gradient-to-br p-5 shadow-sm ${accent}`}>
      <p
        className="text-sm font-semibold text-gray-900"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {node.label}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <NanowheelBadge
          count={node.nanowheels}
          size="md"
          ariaLabel={`${node.nanowheels} at ${node.label}`}
        />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-gray-500">In</dt>
          <dd className="text-lg font-semibold tabular-nums text-gray-900">{node.checkIns}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-gray-500">RSVP</dt>
          <dd className="text-lg font-semibold tabular-nums text-gray-900">{node.rsvpsGoing}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-gray-500">People</dt>
          <dd className="text-lg font-semibold tabular-nums text-gray-900">
            {node.uniqueParticipants}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function formatMonthShort(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short" });
}
