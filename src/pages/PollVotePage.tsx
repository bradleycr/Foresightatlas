/**
 * Two public phones for one poll.
 *
 * `/polls/:slug/add` is where a pitcher adds a project.
 * `/polls/:slug` names a team first, then gives 3, 2, and 1 points to other teams.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import foresightIconUrl from "../assets/Foresight_RGB_Icon_Black.png?url";
import { FORESIGHT_ORG_URL } from "../constants/foresight";
import { PollBallot } from "../components/polls/PollBallot";
import { PollTeamGate } from "../components/polls/PollTeamGate";
import { PollCountdown } from "../components/polls/PollCountdown";
import { PollPodium } from "../components/polls/PollPodium";
import { PollProjectSubmit } from "../components/polls/PollProjectSubmit";
import { themeForEvent } from "../components/polls/pollEventTheme";
import { addProjectToPoll, fetchPublicPoll, getStoredTeam, setStoredTeam, voteOnPoll } from "../services/polls";
import { subscribeToDataChanges } from "../services/sync";
import type { Identity } from "../services/identity";
import type { PollPublic } from "../types/polls";
import { Button } from "../components/ui/button";

interface PollVotePageProps {
  slug: string;
  identity: Identity | null;
  purpose: "add" | "vote";
  onNavigate: (path: string) => void;
}

export function PollVotePage({ slug, identity, purpose, onNavigate }: PollVotePageProps) {
  const [poll, setPoll] = useState<PollPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(() => getStoredTeam(slug));
  const [firstId, setFirstId] = useState<string | null>(null);
  const [secondId, setSecondId] = useState<string | null>(null);
  const [thirdId, setThirdId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  /** True after this phone just pitched — drives the “Go to voting” link. */
  const [justAdded, setJustAdded] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await fetchPublicPoll(slug, identity?.token);
      setPoll(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "This poll is not available.");
      setPoll(null);
    } finally {
      setLoading(false);
    }
  }, [slug, identity?.token]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const unsub = subscribeToDataChanges((msg) => {
      if (msg.scope === "polls" || msg.scope === "all") void load();
    });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void load();
    }, 10000);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!poll || dirty) return;
    const teamKnown = Boolean(
      poll.yourTeamId && poll.options.some((option) => option.id === poll.yourTeamId),
    );
    if (!teamKnown) {
      setFirstId(null);
      setSecondId(null);
      setThirdId(null);
      return;
    }
    setTeamId(poll.yourTeamId);
    setStoredTeam(slug, poll.yourTeamId || "");
    setFirstId(poll.yourFirstId);
    setSecondId(poll.yourSecondId);
    setThirdId(poll.yourThirdId);
  }, [poll, dirty, slug]);

  const handleAdd = async (project: { label: string; people: string; url: string }) => {
    setSaving(true);
    try {
      const next = await addProjectToPoll(slug, project);
      setPoll(next);
      const labelKey = project.label.trim().toLowerCase();
      const mine =
        [...next.options]
          .reverse()
          .find((option) => option.label.trim().toLowerCase() === labelKey) || null;
      if (mine) {
        setStoredTeam(slug, mine.id);
        setTeamId(mine.id);
        setJustAdded(true);
      }
      toast.success("You’re on the slate.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that project.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleVote = async () => {
    if (!poll || !teamId || !firstId || !secondId || !thirdId || saving) return;
    setSaving(true);
    try {
      const next = await voteOnPoll(slug, firstId, secondId, thirdId, teamId, identity?.token);
      setPoll(next);
      setDirty(false);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record your vote.");
    } finally {
      setSaving(false);
    }
  };

  const chooseTeam = (id: string) => {
    setStoredTeam(slug, id);
    setTeamId(id);
    setDirty(true);
    if (!poll?.yourTeamId) {
      setFirstId(null);
      setSecondId(null);
      setThirdId(null);
      return;
    }
    if (firstId === id) setFirstId(null);
    if (secondId === id) setSecondId(null);
    if (thirdId === id) setThirdId(null);
  };

  const theme = themeForEvent(poll?.eventTitle);
  const knownTeam = Boolean(teamId && poll?.options.some((option) => option.id === teamId));
  const myProject =
    knownTeam && poll ? poll.options.find((option) => option.id === teamId) || null : null;
  const showGoVote = Boolean(
    purpose === "add" && poll && poll.status !== "closed" && (justAdded || myProject),
  );
  const submitted = Boolean(
    poll?.yourFirstId && poll?.yourSecondId && poll?.yourThirdId && poll?.yourTeamId && !dirty,
  );
  const selectingTeam = Boolean(
    poll &&
      purpose === "vote" &&
      poll.status === "live" &&
      poll.options.length >= 4 &&
      !knownTeam,
  );

  return (
    <div
      className="flex min-h-[100svh] flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 sm:min-h-[100dvh] sm:items-center sm:px-5 sm:py-10"
      style={{ background: theme.pageBackground }}
    >
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 flex items-center gap-3 sm:mb-8 sm:flex-col sm:text-center">
          <a
            href={FORESIGHT_ORG_URL}
            target="_blank"
            rel="noreferrer"
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/90 shadow-sm sm:size-14 sm:rounded-3xl"
          >
            <img src={foresightIconUrl} alt="Foresight Institute" className="size-6 sm:size-8" />
          </a>
          <div className="min-w-0 sm:text-center">
            <p className={`text-sm font-semibold leading-snug sm:text-base ${theme.kickerClass}`}>
              {theme.kicker}
            </p>
            {theme.detail ? (
              <p className={`mt-1 text-xs ${theme.detailClass}`}>{theme.detail}</p>
            ) : null}
          </div>
        </div>

        {loading && !poll ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-600">
            <Loader2 className="size-4 animate-spin" />
            Opening poll…
          </div>
        ) : null}

        {error && !poll ? (
          <div className="rounded-[1.5rem] border border-white/70 bg-white/85 px-6 py-10 text-center shadow-sm backdrop-blur">
            <p className="font-heading text-xl font-bold text-gray-900">Poll unavailable</p>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
          </div>
        ) : null}

        {poll ? (
          <div className={`rounded-[1.5rem] border p-4 shadow-xl sm:rounded-[1.75rem] sm:p-7 ${theme.ticketClass}`}>
            <h1 className="font-heading text-[1.35rem] font-bold leading-snug text-inherit sm:text-2xl">
              {purpose === "add"
                ? "Add your project"
                : poll.status === "closed"
                  ? "Results"
                  : selectingTeam
                    ? "Select your team"
                    : poll.question}
            </h1>
            {purpose === "vote" && poll.status === "live" && poll.closesAt ? (
              <div className="mt-4">
                <PollCountdown closesAt={poll.closesAt} onElapsed={() => void load()} />
              </div>
            ) : null}

            {purpose === "add" && poll.status !== "closed" ? (
              <div className="mt-4">
                <PollProjectSubmit options={poll.options} saving={saving} onSubmit={handleAdd} />
                {showGoVote ? (
                  <div className="mt-8 border-t border-black/10 pt-6 text-center">
                    {myProject ? (
                      <p className="text-sm text-neutral-600">
                        You’re down as{" "}
                        <span className="font-medium text-neutral-900">{myProject.label}</span>.
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 min-h-[48px] w-full"
                      onClick={() => onNavigate(`/polls/${slug}`)}
                    >
                      Go to voting
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {purpose === "add" && poll.status === "closed" ? (
              <p className="mt-4 text-sm text-gray-600">This poll is closed.</p>
            ) : null}

            {purpose === "vote" && poll.status === "draft" ? (
              <div className="mt-6 text-center">
                <p className="font-heading text-xl font-bold text-inherit">
                  Voting hasn’t started yet
                </p>
                <p className="mt-2 text-sm text-neutral-600">
                  {knownTeam
                    ? "Your team is saved on this phone. Come back when the host opens voting."
                    : "The host will open voting from the admin page."}
                </p>
              </div>
            ) : null}

            {purpose === "vote" && poll.status === "live" && submitted && !editing ? (
              <div className="mt-8 text-center">
                <p className="font-heading text-3xl font-bold">Your vote is cast</p>
                <ul className="mt-6 space-y-2 text-left">
                  {[
                    ["3 points", poll.yourFirstId],
                    ["2 points", poll.yourSecondId],
                    ["1 point", poll.yourThirdId],
                  ].map(([label, id]) => (
                    <li key={label} className="rounded-2xl bg-[#fbf6ea] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{label}</p>
                      <p className="mt-1 font-medium">{poll.options.find((option) => option.id === id)?.label}</p>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-6 min-h-[48px] w-full"
                  onClick={() => setEditing(true)}
                >
                  Change your vote
                </Button>
              </div>
            ) : null}

            {purpose === "vote" && poll.status === "live" && (!submitted || editing) ? (
              <div className="mt-4">
                {poll.options.length < 4 ? (
                  <p className="mt-4 text-sm text-gray-600">Need at least four teams.</p>
                ) : !knownTeam ? (
                  <PollTeamGate options={poll.options} onConfirm={chooseTeam} />
                ) : (
                  <>
                    <p className="mt-3 truncate text-sm">
                      <span className="text-neutral-500">Your team </span>
                      <span className="font-medium">{poll.options.find((option) => option.id === teamId)?.label}</span>
                    </p>
                    <div className="mt-3">
                      <PollBallot
                        options={poll.options}
                        teamId={teamId || ""}
                        firstId={firstId}
                        secondId={secondId}
                        thirdId={thirdId}
                        disabled={saving}
                        onChange={(next) => {
                          setDirty(true);
                          setFirstId(next.firstId);
                          setSecondId(next.secondId);
                          setThirdId(next.thirdId);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={saving || !firstId || !secondId || !thirdId}
                      onClick={() => void handleVote()}
                      className="mt-4 min-h-[48px] w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
                    >
                      {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                      Submit
                    </Button>
                  </>
                )}
              </div>
            ) : null}

            {purpose === "vote" && poll.status === "closed" ? (
              <div className="mt-5">
                <PollPodium results={poll.results} totalBallots={poll.totalVotes} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
