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
import {
  addProjectToPoll,
  clearStoredTeam,
  fetchPublicPoll,
  getStoredJudgeToken,
  getStoredTeam,
  setStoredJudgeToken,
  setStoredTeam,
  voteOnPoll,
} from "../services/polls";
import { subscribeToDataChanges } from "../services/sync";
import type { Identity } from "../services/identity";
import type { PollPublic } from "../types/polls";
import { Button } from "../components/ui/button";

interface PollVotePageProps {
  slug: string;
  identity: Identity | null;
  purpose: "add" | "vote" | "judge";
  onNavigate: (path: string) => void;
}

export function PollVotePage({ slug, identity, purpose, onNavigate }: PollVotePageProps) {
  const [poll, setPoll] = useState<PollPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [firstId, setFirstId] = useState<string | null>(null);
  const [secondId, setSecondId] = useState<string | null>(null);
  const [thirdId, setThirdId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  /** True after this phone just pitched — drives the “Go to voting” link. */
  const [justAdded, setJustAdded] = useState(false);
  const [judgeToken, setJudgeToken] = useState<string | null>(() =>
    purpose === "judge" ? getStoredJudgeToken(slug) : null,
  );

  useEffect(() => {
    if (purpose !== "judge") return;
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("t");
      if (fromUrl && fromUrl.length >= 8) {
        setStoredJudgeToken(slug, fromUrl);
        setJudgeToken(fromUrl);
        /* Drop the token from the address bar so it isn’t casually screenshotted. */
        const clean = `${window.location.pathname}${window.location.hash || ""}`;
        window.history.replaceState({}, "", clean);
        return;
      }
    } catch {
      /* ignore */
    }
    setJudgeToken(getStoredJudgeToken(slug));
  }, [purpose, slug]);

  const load = useCallback(async () => {
    try {
      const next = await fetchPublicPoll(slug, identity?.token, {
        judgeToken: purpose === "judge" ? judgeToken : null,
      });
      setPoll(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "This poll is not available.");
      setPoll(null);
    } finally {
      setLoading(false);
    }
  }, [slug, identity?.token, purpose, judgeToken]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const unsub = subscribeToDataChanges((msg) => {
      if (msg.scope === "polls" || msg.scope === "all") void load();
    });
    /* Draft phones need to notice Go live quickly; live can breathe. */
    const ms = poll?.status === "draft" ? 3000 : 10000;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void load();
    }, ms);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, [load, poll?.status]);

  useEffect(() => {
    if (!poll) return;
    if (purpose === "judge") {
      if (dirty) return;
      if (poll.yourFirstId) {
        setFirstId(poll.yourFirstId);
        setSecondId(poll.yourSecondId);
        setThirdId(poll.yourThirdId);
      }
      return;
    }
    const stored = getStoredTeam(slug, poll.id);
    const fromBallot =
      poll.yourTeamId && poll.options.some((option) => option.id === poll.yourTeamId)
        ? poll.yourTeamId
        : null;
    const resolved =
      fromBallot ||
      (stored && poll.options.some((option) => option.id === stored) ? stored : null);

    setTeamId((prev) => {
      if (resolved) return resolved;
      if (prev && poll.options.some((option) => option.id === prev)) return prev;
      return null;
    });
    if (resolved) setStoredTeam(slug, resolved, poll.id);
    else if (stored) clearStoredTeam(slug);

    if (dirty || !fromBallot) return;
    setFirstId(poll.yourFirstId);
    setSecondId(poll.yourSecondId);
    setThirdId(poll.yourThirdId);
  }, [poll, dirty, slug, purpose]);

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
        setStoredTeam(slug, mine.id, next.id);
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
    if (!poll || !firstId || !secondId || !thirdId || saving) return;
    if (purpose === "judge") {
      if (!judgeToken) return;
    } else if (!teamId) {
      return;
    }
    setSaving(true);
    try {
      const next = await voteOnPoll(
        slug,
        firstId,
        secondId,
        thirdId,
        teamId || "",
        identity?.token,
        { judgeToken: purpose === "judge" ? judgeToken : null },
      );
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
    setStoredTeam(slug, id, poll?.id);
    setTeamId(id);
    setDirty(true);
    setEditing(false);
    setFirstId((prev) => (prev === id ? null : prev));
    setSecondId((prev) => (prev === id ? null : prev));
    setThirdId((prev) => (prev === id ? null : prev));
    if (!poll?.yourTeamId) {
      setFirstId(null);
      setSecondId(null);
      setThirdId(null);
    }
  };

  const changeTeam = () => {
    clearStoredTeam(slug);
    setTeamId(null);
    setFirstId(null);
    setSecondId(null);
    setThirdId(null);
    setDirty(true);
    setEditing(false);
  };

  const theme = themeForEvent(poll?.eventTitle);
  const isJudge = purpose === "judge";
  const knownTeam = Boolean(teamId && poll?.options.some((option) => option.id === teamId));
  const myProject =
    knownTeam && poll ? poll.options.find((option) => option.id === teamId) || null : null;
  const showGoVote = Boolean(
    purpose === "add" && poll && poll.status !== "closed" && (justAdded || myProject),
  );
  const submitted = Boolean(
    isJudge
      ? poll?.yourFirstId && poll?.yourSecondId && poll?.yourThirdId && !dirty
      : poll?.yourFirstId && poll?.yourSecondId && poll?.yourThirdId && poll?.yourTeamId && !dirty,
  );
  const selectingTeam = Boolean(
    poll &&
      purpose === "vote" &&
      poll.status === "live" &&
      poll.options.length >= 4 &&
      !knownTeam,
  );
  const votingOpen = purpose === "vote" || purpose === "judge";

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
            <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${theme.kickerClass}`}>
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
                  : isJudge
                    ? "Judge ballot"
                    : selectingTeam
                      ? "Select your team"
                      : poll.question}
            </h1>
            {isJudge ? (
              <p className="mt-2 text-sm text-neutral-600">
                Your picks are half the final score. Room votes make up the other half.
              </p>
            ) : null}
            {votingOpen && poll.status === "live" && poll.closesAt ? (
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

            {votingOpen && poll.status === "draft" ? (
              <div className="mt-6 text-center">
                <p className="font-heading text-xl font-bold text-inherit">
                  Voting hasn’t started yet
                </p>
                <p className="mt-2 text-sm text-neutral-600">
                  {isJudge
                    ? "Keep this link. Come back when the host opens voting."
                    : knownTeam
                      ? "Your team is saved on this phone. Come back when the host opens voting."
                      : "The host will open voting from the admin page."}
                </p>
              </div>
            ) : null}

            {isJudge && !judgeToken ? (
              <div className="mt-6 text-center">
                <p className="font-heading text-xl font-bold text-inherit">Judge link required</p>
                <p className="mt-2 text-sm text-neutral-600">
                  Open the private judge URL the host sent you.
                </p>
              </div>
            ) : null}

            {votingOpen && poll.status === "live" && submitted && !editing ? (
              <div className="mt-8 text-center">
                <p className="font-heading text-3xl font-bold">
                  {isJudge ? "Judge vote cast" : "Your vote is cast"}
                </p>
                <ul className="mt-6 space-y-2 text-left">
                  {[
                    ["3 points", poll.yourFirstId],
                    ["2 points", poll.yourSecondId],
                    ["1 point", poll.yourThirdId],
                  ].map(([label, id]) => (
                    <li key={String(label)} className="rounded-2xl bg-[#fbf6ea] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                        {label}
                      </p>
                      <p className="mt-1 font-medium">
                        {poll.options.find((option) => option.id === id)?.label}
                      </p>
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

            {votingOpen && poll.status === "live" && (!submitted || editing) ? (
              <div className="mt-4">
                {poll.options.length < 4 ? (
                  <p className="mt-4 text-sm text-gray-600">Need at least four teams.</p>
                ) : isJudge && judgeToken ? (
                  <>
                    <div className="mt-3">
                      <PollBallot
                        options={poll.options}
                        teamId=""
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
                      Submit judge vote
                    </Button>
                  </>
                ) : !knownTeam ? (
                  <PollTeamGate options={poll.options} onConfirm={chooseTeam} />
                ) : (
                  <>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm">
                        <span className="text-neutral-500">Your team </span>
                        <span className="font-medium">
                          {poll.options.find((option) => option.id === teamId)?.label}
                        </span>
                      </p>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-medium text-neutral-500 underline-offset-2 hover:text-neutral-800 hover:underline"
                        onClick={changeTeam}
                      >
                        Change
                      </button>
                    </div>
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

            {votingOpen && poll.status === "closed" ? (
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
