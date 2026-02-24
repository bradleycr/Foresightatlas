/**
 * Berlin Node Programming Page
 *
 * A living Gantt calendar for all 2026 Berlin plans — residencies, workshops,
 * conferences, and visits.  Designed to feel like a polished dashboard that
 * admins can curate without leaving the page.
 */

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Pencil,
  Plus,
  Trash2,
  Users,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { Person, TravelWindow, TravelWindowType } from "../types";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  addTravelWindow,
  updateTravelWindow,
  deleteTravelWindow,
  generateTravelWindowId,
} from "../services/database";
import { cn } from "../components/ui/utils";
import { toast } from "sonner";
import { getNodeLabel } from "../utils/nodeLabels";

type BerlinPageProps = {
  people: Person[];
  travelWindows: TravelWindow[];
  isAdmin: boolean;
  onAdminLogin: () => void;
  onAdminPanel: () => void;
  onNavigateHome: () => void;
  onDataRefresh: () => Promise<void>;
};

type PlanDraft = {
  id?: string;
  personId: string;
  title: string;
  startDate: string;
  endDate: string;
  type: TravelWindowType;
  notes: string;
};

const BERLIN_COORDS = { lat: 52.52, lng: 13.405 };
const YEAR_START = new Date("2026-01-01T00:00:00");
const YEAR_END = new Date("2026-12-31T23:59:59");

const TYPE_COLORS: Record<TravelWindowType, { bar: string; badge: string; text: string }> = {
  Residency: { bar: "from-cyan-300/90 to-sky-400/80", badge: "bg-cyan-100 text-cyan-800 border-cyan-200", text: "text-cyan-700" },
  Conference: { bar: "from-indigo-300/90 to-purple-400/80", badge: "bg-indigo-100 text-indigo-800 border-indigo-200", text: "text-indigo-700" },
  Workshop: { bar: "from-amber-300/90 to-orange-400/80", badge: "bg-amber-100 text-amber-800 border-amber-200", text: "text-amber-700" },
  Visit: { bar: "from-emerald-300/90 to-teal-400/80", badge: "bg-emerald-100 text-emerald-800 border-emerald-200", text: "text-emerald-700" },
  Other: { bar: "from-gray-300/90 to-slate-400/80", badge: "bg-gray-100 text-gray-800 border-gray-200", text: "text-gray-700" },
};

function formatRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startFmt = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endFmt = endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startFmt} – ${endFmt}${startDate.getFullYear() !== endDate.getFullYear() ? `, ${endDate.getFullYear()}` : ""}`;
}

function clampTo2026(date: Date) {
  if (date < YEAR_START) return YEAR_START;
  if (date > YEAR_END) return YEAR_END;
  return date;
}

export function BerlinPage({
  people,
  travelWindows,
  isAdmin,
  onAdminLogin,
  onAdminPanel,
  onNavigateHome,
  onDataRefresh,
}: BerlinPageProps) {
  const berlinLeads = useMemo(
    () => people.filter((person) => person.primaryNode === "Berlin Node"),
    [people]
  );

  const berlinPlans = useMemo(() => {
    const start2026 = YEAR_START.getTime();
    const end2026 = YEAR_END.getTime();

    return travelWindows
      .filter((tw) => tw.city.toLowerCase() === "berlin")
      .filter((tw) => {
        const start = new Date(tw.startDate).getTime();
        const end = new Date(tw.endDate).getTime();
        return start <= end2026 && end >= start2026;
      })
      .map((tw) => {
        const startDate = clampTo2026(new Date(tw.startDate));
        const endDate = clampTo2026(new Date(tw.endDate));
        const person = people.find((p) => p.id === tw.personId);
        const duration =
          Math.ceil(
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          ) + 1;

        return {
          ...tw,
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
          person,
          duration,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );
  }, [people, travelWindows]);

  const totalDays = berlinPlans.reduce((sum, plan) => sum + plan.duration, 0);

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const date = new Date(2026, i, 1);
        return {
          label: date.toLocaleString("en-US", { month: "short" }),
          days: new Date(2026, i + 1, 0).getDate(),
        };
      }),
    []
  );

  const defaultPerson =
    berlinLeads[0]?.id || people.find((p) => p.primaryNode === "Global")?.id || "";

  const [draft, setDraft] = useState<PlanDraft>({
    personId: defaultPerson,
    title: "",
    startDate: "2026-01-08",
    endDate: "2026-01-15",
    type: "Residency",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const resetDraft = () =>
    setDraft({
      personId: defaultPerson,
      title: "",
      startDate: "2026-01-08",
      endDate: "2026-01-15",
      type: "Residency",
      notes: "",
    });

  const handleEdit = (plan: TravelWindow) => {
    setDraft({
      id: plan.id,
      personId: plan.personId,
      title: plan.title,
      startDate: plan.startDate,
      endDate: plan.endDate,
      type: plan.type,
      notes: plan.notes,
    });
  };

  const handleDelete = async (id: string) => {
    try {
      setIsSaving(true);
      await deleteTravelWindow(id);
      toast.success("Plan removed from Berlin calendar");
      await onDataRefresh();
      if (draft.id === id) resetDraft();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete plan";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!draft.title.trim()) {
      toast.error("Give this plan a title so Berlin knows what is happening.");
      return;
    }
    if (!draft.personId) {
      toast.error("Assign a point-person for the Berlin schedule.");
      return;
    }
    if (new Date(draft.startDate) > new Date(draft.endDate)) {
      toast.error("Start date must be before the end date.");
      return;
    }

    const payload: TravelWindow = {
      id: draft.id || generateTravelWindowId(),
      personId: draft.personId,
      title: draft.title.trim(),
      city: "Berlin",
      country: "Germany",
      coordinates: BERLIN_COORDS,
      startDate: draft.startDate,
      endDate: draft.endDate,
      type: draft.type,
      notes: draft.notes.trim(),
    };

    try {
      setIsSaving(true);
      if (draft.id) {
        await updateTravelWindow(draft.id, payload);
        toast.success("Berlin plan updated");
      } else {
        await addTravelWindow(payload);
        toast.success("Berlin plan added to 2026 calendar");
      }
      await onDataRefresh();
      resetDraft();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save Berlin plan";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/30 text-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-8 md:space-y-12">

        {/* ── Nav bar ────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to map
          </button>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 border-emerald-200 text-emerald-700">
                Admin
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={onAdminPanel} className="text-xs h-8 px-3 border-gray-200">
              Admin panel
            </Button>
            {!isAdmin && (
              <Button size="sm" onClick={onAdminLogin} className="text-xs h-8 px-3 bg-gray-900 hover:bg-gray-800">
                Log in
              </Button>
            )}
          </div>
        </div>

        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100/80 overflow-hidden">
          <div className="p-6 md:p-10">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-500">
                  Berlin Node · 2026
                </p>
                <h1
                  className="text-2xl md:text-4xl font-bold leading-tight tracking-tight text-gray-900"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Programming Calendar
                </h1>
                <p className="text-sm md:text-base text-gray-500 leading-relaxed">
                  A living Gantt for everything planned in Berlin across 2026.
                  Residencies, workshops, conferences, and visits mapped month by
                  month so the node can see momentum at a glance.
                </p>
              </div>

              {/* Stat cards */}
              <div className="flex gap-3 flex-shrink-0">
                <StatCard icon={<BarChart3 className="size-4" />} label="Plans" value={berlinPlans.length} gradient="from-blue-600 to-indigo-600" />
                <StatCard icon={<Users className="size-4" />} label="Fellows" value={berlinLeads.length} gradient="from-emerald-500 to-teal-500" />
                <StatCard icon={<CalendarDays className="size-4" />} label="Days" value={totalDays} gradient="from-amber-500 to-orange-500" />
              </div>
            </div>
          </div>

          {/* ── Gantt chart ──────────────────────────────────── */}
          <div className="border-t border-gray-100 bg-gradient-to-b from-gray-50/40 to-white p-4 md:p-8">
            {/* Month header labels */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-gray-900">Gantt View</h2>
              <div className="flex items-center gap-3 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                <span className="flex items-center gap-1"><CalendarDays className="size-3" /> Months</span>
                <span className="flex items-center gap-1"><Clock3 className="size-3" /> Duration</span>
              </div>
            </div>

            <div className="overflow-x-auto -mx-2 px-2 pb-2">
              <div className="min-w-[960px] space-y-2">
                {/* Month axis */}
                <div className="grid grid-cols-[220px_repeat(12,minmax(0,1fr))] gap-x-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-1">
                  <div className="text-xs text-gray-500 normal-case tracking-normal font-semibold">Plan</div>
                  {months.map((month) => (
                    <div key={month.label} className="text-center">{month.label}</div>
                  ))}
                </div>

                {berlinPlans.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
                    <Sparkles className="size-6 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">
                      No Berlin programming scheduled for 2026 yet.
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Add the first plan below.</p>
                  </div>
                )}

                {berlinPlans.map((plan) => {
                  const startDate = new Date(plan.startDate);
                  const endDate = new Date(plan.endDate);
                  const daysInStartMonth = months[startDate.getMonth()].days;
                  const startFraction =
                    (startDate.getMonth() +
                      (startDate.getDate() - 1) / daysInStartMonth) /
                    12;
                  const endFraction =
                    (endDate.getMonth() +
                      endDate.getDate() /
                        months[endDate.getMonth()].days) /
                    12;
                  const left = Math.max(0, Math.min(100, startFraction * 100));
                  const width = Math.max(
                    3,
                    Math.min(100 - left, (endFraction - startFraction) * 100)
                  );
                  const typeStyle = TYPE_COLORS[plan.type];

                  return (
                    <div
                      key={plan.id}
                      className="grid grid-cols-[220px_1fr] gap-x-3 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-shadow p-3 md:p-4"
                    >
                      {/* Left label */}
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            {plan.title}
                          </span>
                          <span className={cn("inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border", typeStyle.badge)}>
                            {plan.type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {plan.person?.fullName || "Unassigned lead"}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {formatRange(plan.startDate, plan.endDate)} · {plan.duration}d
                        </p>
                        {isAdmin && (
                          <div className="flex gap-1.5 pt-1">
                            <button
                              onClick={() => handleEdit(plan)}
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md transition-colors"
                            >
                              <Pencil className="size-3" /> Edit
                            </button>
                            <button
                              onClick={() => handleDelete(plan.id)}
                              disabled={isSaving}
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors disabled:opacity-40"
                            >
                              <Trash2 className="size-3" /> Remove
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Bar area */}
                      <div className="relative self-center">
                        <div className="grid grid-cols-12 gap-1 h-10">
                          {months.map((month) => (
                            <div
                              key={`${plan.id}-${month.label}`}
                              className="h-full rounded-md border border-dashed border-gray-100 bg-gray-50/50"
                            />
                          ))}
                        </div>
                        <div
                          className={cn(
                            "absolute top-0.5 bottom-0.5 rounded-md shadow-sm overflow-hidden"
                          )}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          <div className={cn("h-full w-full bg-gradient-to-r", typeStyle.bar)} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Bottom cards ───────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Highlights */}
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100/80 p-6 md:p-8 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Berlin Node Highlights</h3>
              <p className="text-xs text-gray-400 mt-1">Quick signal on the strength of the Berlin program.</p>
            </div>
            <div className="space-y-3">
              <HighlightRow
                accent="bg-blue-500"
                label="Resident-driven activity"
                description={`Anchored by ${berlinLeads.length} Berlin-based fellows and ${berlinPlans.length} confirmed plans.`}
                icon={<CalendarDays className="size-5 text-blue-500" />}
              />
              <HighlightRow
                accent="bg-emerald-500"
                label="Momentum"
                description={`${totalDays} Berlin days already committed across 2026.`}
                icon={<Clock3 className="size-5 text-emerald-500" />}
              />
            </div>
          </div>

          {/* Admin form */}
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100/80 p-6 md:p-8 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Curate the Berlin Plan</h3>
              <p className="text-xs text-gray-400 mt-1">
                Admins can adapt the Berlin calendar without leaving this view.
              </p>
            </div>

            {!isAdmin && (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-5 py-4 text-center">
                <p className="text-sm font-medium text-gray-700">Admin access required</p>
                <p className="text-xs text-gray-500 mt-1">
                  Log in to adjust Berlin plans directly from this page.
                </p>
                <Button className="mt-3 text-xs h-8 px-4 bg-gray-900 hover:bg-gray-800" size="sm" onClick={onAdminLogin}>
                  Admin login
                </Button>
              </div>
            )}

            <div className={cn(!isAdmin && "pointer-events-none opacity-50 select-none", "space-y-4")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldGroup label="Plan title">
                  <Input
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    placeholder="Residency, workshop, summit..."
                  />
                </FieldGroup>
                <FieldGroup label="Lead">
                  <Select
                    value={draft.personId}
                    onValueChange={(val) => setDraft((d) => ({ ...d, personId: val }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                    <SelectContent>
                      {people.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.fullName} · {getNodeLabel(person.primaryNode)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldGroup>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldGroup label="Start date">
                  <Input type="date" value={draft.startDate} onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))} min="2026-01-01" max="2026-12-31" />
                </FieldGroup>
                <FieldGroup label="End date">
                  <Input type="date" value={draft.endDate} onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))} min="2026-01-01" max="2026-12-31" />
                </FieldGroup>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldGroup label="Type">
                  <Select value={draft.type} onValueChange={(val) => setDraft((d) => ({ ...d, type: val as TravelWindowType }))}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {(["Residency", "Conference", "Workshop", "Visit", "Other"] as TravelWindowType[]).map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldGroup>
                <FieldGroup label="Notes">
                  <Textarea
                    value={draft.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    placeholder="Agenda, partners, venues..."
                    rows={3}
                  />
                </FieldGroup>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button onClick={handleSave} disabled={isSaving} className="bg-gray-900 hover:bg-gray-800 text-xs h-9 px-4">
                  <Plus className="size-3.5 mr-1.5" />
                  {draft.id ? "Update plan" : "Add to Berlin 2026"}
                </Button>
                <Button type="button" variant="ghost" onClick={resetDraft} disabled={isSaving} className="text-xs h-9 px-3 text-gray-500">
                  Clear
                </Button>
                {draft.id && (
                  <Badge variant="outline" className="text-[10px] font-semibold bg-blue-50 border-blue-200 text-blue-700">
                    Editing existing plan
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─── Tiny sub-components ─────────────────────────────────────────────── */

function StatCard({ icon, label, value, gradient }: { icon: React.ReactNode; label: string; value: number; gradient: string }) {
  return (
    <div className={cn("rounded-xl bg-gradient-to-br text-white px-4 py-3 shadow-md min-w-[88px]", gradient)}>
      <div className="flex items-center gap-1.5 mb-1 opacity-80">{icon}<span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span></div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function HighlightRow({ accent, label, description, icon }: { accent: string; label: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3.5 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3.5">
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
