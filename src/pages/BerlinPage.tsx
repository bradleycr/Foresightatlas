import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Person, TravelWindow, TravelWindowType } from "../types";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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

const TYPE_STYLES: Record<
  TravelWindowType,
  { bg: string; border: string; text: string }
> = {
  Residency: {
    bg: "from-cyan-50/80 via-cyan-100/70 to-sky-100/70",
    border: "border-cyan-200",
    text: "text-cyan-900",
  },
  Conference: {
    bg: "from-indigo-50/80 via-indigo-100/70 to-purple-100/70",
    border: "border-indigo-200",
    text: "text-indigo-900",
  },
  Workshop: {
    bg: "from-amber-50/80 via-yellow-50/70 to-orange-100/70",
    border: "border-amber-200",
    text: "text-amber-900",
  },
  Visit: {
    bg: "from-emerald-50/80 via-emerald-100/70 to-teal-100/70",
    border: "border-emerald-200",
    text: "text-emerald-900",
  },
  Other: {
    bg: "from-slate-50/80 via-gray-100/70 to-gray-50/70",
    border: "border-gray-200",
    text: "text-gray-900",
  },
};

function formatRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startFmt = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endFmt = endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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
      if (draft.id === id) {
        resetDraft();
      }
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

  const heroBadge = isAdmin ? "Admin live view" : "Public demo";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50 text-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateHome}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="size-4 mr-2" />
              Back to map
            </Button>
            <Badge variant="outline" className="bg-white/80">
              {heroBadge}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onAdminPanel}>
              Open admin panel
            </Button>
            {!isAdmin && (
              <Button size="sm" onClick={onAdminLogin}>
                Admin login
              </Button>
            )}
          </div>
        </div>

        <section className="rounded-3xl bg-white/80 shadow-lg ring-1 ring-gray-100 p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.2em] text-blue-500">
                Berlin Node · 2026
              </p>
              <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
                Programming calendar for the Berlin Node
              </h1>
              <p className="text-gray-600 max-w-2xl">
                A clean, living Gantt for everything planned in Berlin across
                2026. Residencies, workshops, conferences, and special visits
                are mapped month by month so the node can see momentum at a
                glance.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white px-4 py-3 shadow-md">
                <p className="text-xs uppercase tracking-wide text-white/80">
                  Active plans
                </p>
                <p className="text-3xl font-semibold">{berlinPlans.length}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white px-4 py-3 shadow-md">
                <p className="text-xs uppercase tracking-wide text-white/80">
                  Berlin fellows
                </p>
                <p className="text-3xl font-semibold">{berlinLeads.length}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white px-4 py-3 shadow-md">
                <p className="text-xs uppercase tracking-wide text-white/80">
                  Node days booked
                </p>
                <p className="text-3xl font-semibold">{totalDays}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-blue-50/30 p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                  Berlin programming calendar
                </p>
                <h2 className="text-xl font-semibold text-gray-900">
                  Gantt view · 2026
                </h2>
                <p className="text-sm text-gray-600">
                  Each bar is a Berlin-based plan. Bars clamp to 2026 so
                  multi-year residencies stay readable.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-4 text-blue-500" /> Months
                </span>
                <span className="flex items-center gap-1">
                  <Clock3 className="size-4 text-amber-500" /> Duration
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[1040px] space-y-3">
                <div className="grid grid-cols-[240px_repeat(12,minmax(0,1fr))] gap-x-2 text-xs text-gray-600 pl-2 pr-1">
                  <div className="text-sm font-semibold text-gray-700">
                    Plan
                  </div>
                  {months.map((month) => (
                    <div
                      key={month.label}
                      className="text-center font-medium tracking-tight"
                    >
                      {month.label}
                    </div>
                  ))}
                </div>

                {berlinPlans.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white/70 p-6 text-center text-gray-600">
                    No Berlin programming is scheduled for 2026 yet. Add the
                    first plan below.
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
                    4,
                    Math.min(100 - left, (endFraction - startFraction) * 100)
                  );
                  const typeStyle = TYPE_STYLES[plan.type];

                  return (
                    <div
                      key={plan.id}
                      className="grid grid-cols-[240px_1fr] gap-x-3 rounded-2xl border border-gray-100 bg-white/90 shadow-sm p-3 md:p-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">
                            {plan.title}
                          </span>
                          <Badge variant="outline">{plan.type}</Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          {plan.person?.fullName || "Unassigned lead"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatRange(plan.startDate, plan.endDate)} ·{" "}
                          {plan.duration} days
                        </p>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(plan)}
                              className="h-8 px-3 text-xs"
                            >
                              <Pencil className="size-4 mr-1" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-3 text-xs text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(plan.id)}
                              disabled={isSaving}
                            >
                              <Trash2 className="size-4 mr-1" /> Remove
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <div className="grid grid-cols-12 gap-2 h-12">
                          {months.map((month) => (
                            <div
                              key={`${plan.id}-${month.label}`}
                              className="h-full rounded-lg border border-dashed border-gray-200 bg-gray-50"
                            />
                          ))}
                        </div>
                        <div
                          className={cn(
                            "absolute top-1 bottom-1 rounded-lg border shadow-sm overflow-hidden",
                            typeStyle.border
                          )}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          <div
                            className={cn(
                              "h-full w-full bg-gradient-to-r",
                              typeStyle.bg
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white/90 shadow-lg border-gray-100">
            <CardHeader>
              <CardTitle>Berlin node highlights</CardTitle>
              <CardDescription>
                Quick signal on the strength of the Berlin program.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-blue-500">
                    Resident-driven activity
                  </p>
                  <p className="text-sm text-gray-700">
                    Anchored by {berlinLeads.length} Berlin-based fellows and{" "}
                    {berlinPlans.length} confirmed plans.
                  </p>
                </div>
                <CalendarDays className="size-6 text-blue-500" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-600">
                    Momentum
                  </p>
                  <p className="text-sm text-gray-700">
                    {totalDays} Berlin days already committed across 2026.
                  </p>
                </div>
                <Clock3 className="size-6 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/95 shadow-lg border-gray-100">
            <CardHeader>
              <CardTitle>Curate the Berlin plan</CardTitle>
              <CardDescription>
                Admins can adapt the Berlin-specific calendar without leaving
                this view.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isAdmin && (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  <p className="font-medium">Admin access required</p>
                  <p className="text-gray-600">
                    Log in to adjust Berlin plans directly from this demo page.
                  </p>
                  <Button
                    className="mt-3"
                    size="sm"
                    onClick={onAdminLogin}
                    variant="default"
                  >
                    Admin login
                  </Button>
                </div>
              )}

              <div className={cn(!isAdmin && "pointer-events-none opacity-70")}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-800">
                      Plan title
                    </label>
                    <Input
                      value={draft.title}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, title: e.target.value }))
                      }
                      placeholder="Residency, workshop, summit..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-800">
                      Lead
                    </label>
                    <Select
                      value={draft.personId}
                      onValueChange={(val) =>
                        setDraft((d) => ({ ...d, personId: val }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select person" />
                      </SelectTrigger>
                      <SelectContent>
                        {people.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.fullName} · {getNodeLabel(person.primaryNode)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-800">
                      Start date
                    </label>
                    <Input
                      type="date"
                      value={draft.startDate}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, startDate: e.target.value }))
                      }
                      min="2026-01-01"
                      max="2026-12-31"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-800">
                      End date
                    </label>
                    <Input
                      type="date"
                      value={draft.endDate}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, endDate: e.target.value }))
                      }
                      min="2026-01-01"
                      max="2026-12-31"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-800">
                      Type
                    </label>
                    <Select
                      value={draft.type}
                      onValueChange={(val) =>
                        setDraft((d) => ({ ...d, type: val as TravelWindowType }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          ["Residency", "Conference", "Workshop", "Visit", "Other"] as TravelWindowType[]
                        ).map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-800">
                      Notes
                    </label>
                    <Textarea
                      value={draft.notes}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, notes: e.target.value }))
                      }
                      placeholder="Agenda, partners, venues..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Plus className="size-4 mr-2" />
                    {draft.id ? "Update Berlin plan" : "Add to Berlin 2026"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetDraft}
                    disabled={isSaving}
                  >
                    Clear
                  </Button>
                  {draft.id && (
                    <Badge variant="outline" className="border-blue-200 text-blue-800">
                      Editing existing plan
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

