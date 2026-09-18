/**
 * Secret admin hub at /polls — not linked in the header.
 *
 * Primary job: favourite-project ballots for Foresight events. Paste project
 * names, go live, share the QR. Usually one live poll; sometimes two. Add a
 * late project while the room is still voting.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Identity } from "../services/identity";
import type { NodeEvent } from "../types/events";
import type { PollAdmin } from "../types/polls";
import {
  createPoll,
  fetchAdminPolls,
  updatePoll,
} from "../services/polls";
import { subscribeToDataChanges } from "../services/sync";
import { isEventUpcoming } from "../utils/eventTiming";
import { PollQrCard } from "../components/polls/PollQrCard";
import { PollResultsBars } from "../components/polls/PollResultsBars";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Z_INDEX_MODAL_BACKDROP, Z_INDEX_MODAL_CONTENT } from "../constants/zIndex";

interface PollsPageProps {
  identity: Identity | null;
  events: NodeEvent[] | null;
  onNavigateHome: () => void;
  onNavigate: (path: string) => void;
}

const EMPTY_PROJECTS = ["", ""];
const MAX_POLL_OPTIONS = 48;
const DEFAULT_QUESTION = "Which project did you like most?";

/** Soft paper + ink — matches Atlas chrome, not generic sky/indigo SaaS. */
const PAGE_BG =
  "linear-gradient(180deg, #f7f6f3 0%, #ffffff 42%, #f3f1ec 100%)";

export function PollsPage({
  identity,
  events,
  onNavigateHome,
  onNavigate,
}: PollsPageProps) {
  const [polls, setPolls] = useState<PollAdmin[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [projects, setProjects] = useState<string[]>(EMPTY_PROJECTS);
  const [pasteOpen, setPasteOpen] = useState(true);
  const [pasteText, setPasteText] = useState("");
  const [eventId, setEventId] = useState("");
  const [saving, setSaving] = useState(false);
  const [qrPoll, setQrPoll] = useState<PollAdmin | null>(null);
  const [editing, setEditing] = useState<PollAdmin | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editProjects, setEditProjects] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [addProjectFor, setAddProjectFor] = useState<PollAdmin | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [addingProject, setAddingProject] = useState(false);

  const load = useCallback(async () => {
    if (!identity?.token) return;
    try {
      const data = await fetchAdminPolls(identity.token);
      setPolls(data.polls);
      setCanManage(data.canManage);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load polls.");
    } finally {
      setLoading(false);
    }
  }, [identity?.token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return subscribeToDataChanges((msg) => {
      if (msg.scope === "polls" || msg.scope === "all") void load();
    });
  }, [load]);

  const eventChoices = useMemo(() => {
    const list = events ?? [];
    const upcoming = list.filter((e) => isEventUpcoming(e));
    const past = list.filter((e) => !isEventUpcoming(e));
    upcoming.sort((a, b) => a.startAt.localeCompare(b.startAt));
    past.sort((a, b) => b.startAt.localeCompare(a.startAt));
    return { upcoming, past };
  }, [events]);

  const live = polls.filter((p) => p.status === "live");
  const drafts = polls.filter((p) => p.status === "draft");
  const closed = polls.filter((p) => p.status === "closed");

  const selectedEvent = (events ?? []).find((e) => e.id === eventId);

  const applyPasteList = (text: string, into: "create" | "edit") => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, MAX_POLL_OPTIONS);
    if (lines.length < 2) {
      toast.error("Paste at least two project names, one per line.");
      return false;
    }
    if (into === "create") {
      setProjects(lines);
      setPasteOpen(false);
    } else {
      setEditProjects(lines);
    }
    return true;
  };

  const handleCreate = async () => {
    if (!identity?.token) return;
    setSaving(true);
    try {
      const poll = await createPoll(identity.token, {
        question,
        options: projects,
        eventId: eventId || undefined,
        eventTitle: selectedEvent?.title,
      });
      setPolls((prev) => [poll, ...prev.filter((p) => p.id !== poll.id)]);
      setQuestion(DEFAULT_QUESTION);
      setProjects(EMPTY_PROJECTS);
      setPasteText("");
      setPasteOpen(true);
      setEventId("");
      toast.success("Draft saved. Go live when the room is ready.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create poll.");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (
    poll: PollAdmin,
    status: "live" | "closed",
    opts?: { closeOtherLive?: boolean },
  ) => {
    if (!identity?.token) return;
    try {
      const next = await updatePoll(identity.token, {
        slug: poll.slug,
        status,
        closeOtherLive: opts?.closeOtherLive,
      });
      await load();
      if (status === "live") {
        setQrPoll(next);
        toast.success("Poll is live. Share the QR with the room.");
      } else {
        toast.success("Poll closed. It’s in the archive.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update poll.");
    }
  };

  const handleGoLive = async (poll: PollAdmin) => {
    const others = live.filter((p) => p.id !== poll.id);
    if (others.length === 0) {
      await setStatus(poll, "live");
      return;
    }
    const names = others.map((p) => p.question).join(" · ");
    const closeOthers = window.confirm(
      `There’s already ${others.length === 1 ? "a live poll" : `${others.length} live polls`}:\n\n${names}\n\nOK = close ${others.length === 1 ? "it" : "them"} and go live with this one (usual).\nCancel = keep both live.`,
    );
    await setStatus(poll, "live", { closeOtherLive: closeOthers });
  };

  const openEdit = (poll: PollAdmin) => {
    setEditing(poll);
    setEditQuestion(poll.question);
    setEditProjects(poll.options.map((o) => o.label));
  };

  const saveEdit = async () => {
    if (!identity?.token || !editing) return;
    setEditSaving(true);
    try {
      const next = await updatePoll(identity.token, {
        slug: editing.slug,
        question: editQuestion,
        options: editProjects,
      });
      setPolls((prev) => prev.map((p) => (p.id === next.id ? next : p)));
      setEditing(null);
      toast.success("Draft updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save draft.");
    } finally {
      setEditSaving(false);
    }
  };

  const saveNewProject = async () => {
    if (!identity?.token || !addProjectFor) return;
    const label = newProjectName.trim();
    if (!label) {
      toast.error("Enter a project name.");
      return;
    }
    setAddingProject(true);
    try {
      const next = await updatePoll(identity.token, {
        slug: addProjectFor.slug,
        addOption: label,
      });
      setPolls((prev) => prev.map((p) => (p.id === next.id ? next : p)));
      setAddProjectFor(null);
      setNewProjectName("");
      toast.success(`Added “${label}”. Voters will see it on refresh.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add project.");
    } finally {
      setAddingProject(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <button
          type="button"
          onClick={onNavigateHome}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg py-2 pr-2 text-sm font-medium text-neutral-600 transition-colors hover:text-[var(--primary)] touch-manipulation"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to map
        </button>

        <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Secret · not in navigation
            </p>
            <h1 className="font-heading mt-1 text-3xl font-bold tracking-tight text-[var(--primary)] sm:text-4xl">
              Polls
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
              Favourite-project voting for the room. Paste the project names,
              go live, project the QR. Guests scan and vote anonymously — usually
              one poll at a time. Reach this page at{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-800">
                /polls
              </code>
              .
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

        {live.length > 1 ? (
          <p className="mt-6 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {live.length} polls are live. Fine for parallel rooms — otherwise close
            the spare so people don’t scan the wrong QR.
          </p>
        ) : null}

        {loading && polls.length === 0 ? (
          <div className="mt-12 flex items-center justify-center gap-3 text-neutral-600">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Loading polls…
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        {canManage ? (
          <section className="mt-10 rounded-[1.5rem] border border-neutral-200/90 bg-white p-5 shadow-[0_1px_0_rgba(3,2,19,0.04)] sm:p-7">
            <h2 className="font-heading text-lg font-bold text-[var(--primary)]">
              New project poll
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Paste the projects (one per line), tweak the question if you want,
              save as draft — then go live when the room is ready.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <Label htmlFor="poll-question">Question</Label>
                <Input
                  id="poll-question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={DEFAULT_QUESTION}
                  className="mt-1.5 min-h-[44px]"
                  maxLength={200}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    DEFAULT_QUESTION,
                    "Favourite project?",
                    "Which demo should win?",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQuestion(preset)}
                      className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-white"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="poll-event">Event (optional)</Label>
                <select
                  id="poll-event"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-md border border-neutral-300 bg-white px-3 text-sm shadow-sm"
                >
                  <option value="">Standalone — not tied to a calendar event</option>
                  {eventChoices.upcoming.length > 0 ? (
                    <optgroup label="Upcoming">
                      {eventChoices.upcoming.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.title}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {eventChoices.past.length > 0 ? (
                    <optgroup label="Past">
                      {eventChoices.past.slice(0, 40).map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.title}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </div>
              <ProjectListEditor
                projects={projects}
                onChange={setProjects}
                pasteOpen={pasteOpen}
                onTogglePaste={() => setPasteOpen((v) => !v)}
                pasteText={pasteText}
                onPasteText={setPasteText}
                onApplyPaste={() => applyPasteList(pasteText, "create")}
              />
              <Button
                type="button"
                onClick={() => void handleCreate()}
                disabled={saving}
                className="min-h-[44px] bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Save draft
              </Button>
            </div>
          </section>
        ) : !loading ? (
          <p className="mt-8 text-sm text-neutral-600">
            You can view live and archived polls. Only Foresight Team can create
            them.
          </p>
        ) : null}

        <PollSection
          title="Live"
          empty="No live poll. Draft one and put it live when the room is ready."
          polls={live}
          canManage={canManage}
          onQr={setQrPoll}
          onLiveDisplay={(p) => onNavigate(`/polls/${p.slug}/live`)}
          onVote={(p) => onNavigate(`/polls/${p.slug}`)}
          onClose={(p) => void setStatus(p, "closed")}
          onAddProject={(p) => {
            setAddProjectFor(p);
            setNewProjectName("");
          }}
        />
        <PollSection
          title="Drafts"
          empty="No drafts."
          polls={drafts}
          canManage={canManage}
          onGoLive={(p) => void handleGoLive(p)}
          onEdit={openEdit}
        />
        <PollSection
          title="Archive"
          empty="Closed polls from past events will collect here."
          polls={closed}
          canManage={false}
          showResults
        />
      </div>

      {qrPoll ? (
        <ModalShell onClose={() => setQrPoll(null)}>
          <PollQrCard
            slug={qrPoll.slug}
            question={qrPoll.question}
            eventTitle={qrPoll.eventTitle}
            showActions
          />
          <Button
            type="button"
            className="mt-4 min-h-[44px] w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
            onClick={() => {
              onNavigate(`/polls/${qrPoll.slug}/live`);
              setQrPoll(null);
            }}
          >
            <Radio className="size-4" />
            Open live display
          </Button>
        </ModalShell>
      ) : null}

      {editing ? (
        <ModalShell onClose={() => setEditing(null)} wide>
          <h3 className="font-heading text-xl font-bold text-[var(--primary)]">
            Edit draft
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            Change the question or project list before you go live.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="edit-question">Question</Label>
              <Input
                id="edit-question"
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                className="mt-1.5 min-h-[44px]"
                maxLength={200}
              />
            </div>
            <ProjectListEditor
              projects={editProjects}
              onChange={setEditProjects}
              pasteOpen={false}
              onTogglePaste={() => {}}
              pasteText=""
              onPasteText={() => {}}
              onApplyPaste={() => true}
              hidePasteToggle
              showRowsOnly
            />
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                disabled={editSaving}
                className="min-h-[44px] bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
                onClick={() => void saveEdit()}
              >
                {editSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                Save changes
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {addProjectFor ? (
        <ModalShell onClose={() => setAddProjectFor(null)}>
          <h3 className="font-heading text-xl font-bold text-[var(--primary)]">
            Add a project
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            Late entry for{" "}
            <span className="font-medium text-neutral-800">{addProjectFor.question}</span>
            . Existing votes stay put; phones pick up the new name on refresh.
          </p>
          <Label htmlFor="new-project" className="mt-4 block">
            Project name
          </Label>
          <Input
            id="new-project"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="e.g. Nanowheel cockpit"
            className="mt-1.5 min-h-[44px]"
            maxLength={120}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveNewProject();
            }}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={addingProject}
              className="min-h-[44px] bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
              onClick={() => void saveNewProject()}
            >
              {addingProject ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add to live poll
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setAddProjectFor(null)}
            >
              Cancel
            </Button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

function ModalShell({
  children,
  onClose,
  wide,
}: {
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(3, 2, 19, 0.5)",
        backdropFilter: "blur(8px)",
        zIndex: Z_INDEX_MODAL_BACKDROP,
      }}
      onClick={onClose}
    >
      <div
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6 ${wide ? "max-w-lg" : "max-w-md"}`}
        style={{ zIndex: Z_INDEX_MODAL_CONTENT }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

function ProjectListEditor({
  projects,
  onChange,
  pasteOpen,
  onTogglePaste,
  pasteText,
  onPasteText,
  onApplyPaste,
  hidePasteToggle,
  showRowsOnly,
}: {
  projects: string[];
  onChange: (next: string[]) => void;
  pasteOpen: boolean;
  onTogglePaste: () => void;
  pasteText: string;
  onPasteText: (text: string) => void;
  onApplyPaste: (text?: string) => boolean | void;
  hidePasteToggle?: boolean;
  showRowsOnly?: boolean;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <Label>Projects</Label>
        <p className="text-xs tabular-nums text-neutral-500">
          {projects.filter((o) => o.trim()).length} / {MAX_POLL_OPTIONS}
        </p>
      </div>

      {!showRowsOnly && pasteOpen ? (
        <div className="mt-1.5">
          <textarea
            value={pasteText}
            onChange={(e) => onPasteText(e.target.value)}
            rows={7}
            placeholder={"One project per line\nOrbital greenhouse\nSignal mesh\n…"}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
          <Button
            type="button"
            variant="outline"
            className="mt-2 min-h-[44px]"
            onClick={() => onApplyPaste()}
          >
            Use this list
          </Button>
        </div>
      ) : null}

      <div className="mt-1.5 max-h-[min(40vh,22rem)] space-y-2 overflow-y-auto pr-0.5">
        {projects.map((project, index) => (
          <div key={index} className="flex gap-2">
            <span className="mt-2.5 w-6 shrink-0 text-right text-xs tabular-nums text-neutral-400">
              {index + 1}
            </span>
            <Input
              value={project}
              onChange={(e) => {
                const next = [...projects];
                next[index] = e.target.value;
                onChange(next);
              }}
              placeholder={`Project ${index + 1}`}
              className="min-h-[44px]"
              maxLength={120}
            />
            {projects.length > 2 ? (
              <button
                type="button"
                onClick={() => onChange(projects.filter((_, i) => i !== index))}
                className="flex size-11 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-neutral-400 hover:text-neutral-700"
                aria-label={`Remove project ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {projects.length < MAX_POLL_OPTIONS ? (
          <button
            type="button"
            onClick={() => onChange([...projects, ""])}
            className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:opacity-80"
          >
            <Plus className="size-4" />
            Add project
          </button>
        ) : null}
        {!hidePasteToggle ? (
          <button
            type="button"
            onClick={onTogglePaste}
            className="inline-flex min-h-[40px] items-center text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            {pasteOpen ? "Hide paste list" : "Paste a list"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PollSection({
  title,
  empty,
  polls,
  canManage,
  showResults,
  onQr,
  onLiveDisplay,
  onVote,
  onGoLive,
  onClose,
  onEdit,
  onAddProject,
}: {
  title: string;
  empty: string;
  polls: PollAdmin[];
  canManage: boolean;
  showResults?: boolean;
  onQr?: (poll: PollAdmin) => void;
  onLiveDisplay?: (poll: PollAdmin) => void;
  onVote?: (poll: PollAdmin) => void;
  onGoLive?: (poll: PollAdmin) => void;
  onClose?: (poll: PollAdmin) => void;
  onEdit?: (poll: PollAdmin) => void;
  onAddProject?: (poll: PollAdmin) => void;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-500">
        {title}
      </h2>
      {polls.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {polls.map((poll) => (
            <li
              key={poll.id}
              className="rounded-2xl border border-neutral-200/90 bg-white px-5 py-4 shadow-[0_1px_0_rgba(3,2,19,0.04)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  {poll.eventTitle ? (
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                      {poll.eventTitle}
                    </p>
                  ) : null}
                  <p className="font-heading text-lg font-bold text-[var(--primary)]">
                    {poll.question}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {poll.options.length} project{poll.options.length === 1 ? "" : "s"}
                    {poll.totalVotes ? ` · ${poll.totalVotes} votes` : ""}
                  </p>
                  {poll.status === "live" || poll.status === "draft" ? (
                    <p className="mt-2 line-clamp-2 text-xs text-neutral-500">
                      {poll.options.map((o) => o.label).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {onVote ? (
                    <Button variant="outline" size="sm" className="min-h-[40px]" onClick={() => onVote(poll)}>
                      Vote view
                    </Button>
                  ) : null}
                  {onQr ? (
                    <Button variant="outline" size="sm" className="min-h-[40px]" onClick={() => onQr(poll)}>
                      <QrCode className="size-4" />
                      QR
                    </Button>
                  ) : null}
                  {onLiveDisplay ? (
                    <Button variant="outline" size="sm" className="min-h-[40px]" onClick={() => onLiveDisplay(poll)}>
                      <Radio className="size-4" />
                      Live
                    </Button>
                  ) : null}
                  {canManage && onEdit ? (
                    <Button variant="outline" size="sm" className="min-h-[40px]" onClick={() => onEdit(poll)}>
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                  ) : null}
                  {canManage && onAddProject ? (
                    <Button variant="outline" size="sm" className="min-h-[40px]" onClick={() => onAddProject(poll)}>
                      <Plus className="size-4" />
                      Add project
                    </Button>
                  ) : null}
                  {canManage && onGoLive ? (
                    <Button
                      size="sm"
                      className="min-h-[40px] bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
                      onClick={() => onGoLive(poll)}
                    >
                      Go live
                    </Button>
                  ) : null}
                  {canManage && onClose ? (
                    <Button variant="outline" size="sm" className="min-h-[40px]" onClick={() => onClose(poll)}>
                      Close
                    </Button>
                  ) : null}
                </div>
              </div>
              {showResults && poll.totalVotes > 0 ? (
                <div className="mt-4 border-t border-neutral-100 pt-4">
                  <PollResultsBars results={poll.results} totalVotes={poll.totalVotes} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
