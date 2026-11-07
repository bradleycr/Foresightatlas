/**
 * Two public phones for one poll.
 *
 * `/polls/:slug/add` is where a pitcher adds a project.
 * `/polls/:slug` is the ballot: favorite gets 2 points, runner-up gets 1.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import foresightIconUrl from "../assets/Foresight_RGB_Icon_Black.png?url";
import { FORESIGHT_ORG_URL } from "../constants/foresight";
import { PollBallot } from "../components/polls/PollBallot";
import { PollPodium } from "../components/polls/PollPodium";
import { PollProjectSubmit } from "../components/polls/PollProjectSubmit";
import { themeForEvent } from "../components/polls/pollEventTheme";
import { addProjectToPoll, fetchPublicPoll, voteOnPoll } from "../services/polls";
import { subscribeToDataChanges } from "../services/sync";
import type { Identity } from "../services/identity";
import type { PollPublic } from "../types/polls";
import { Button } from "../components/ui/button";

interface PollVotePageProps {
  slug: string;
  identity: Identity | null;
  purpose: "add" | "vote";
}

export function PollVotePage({ slug, identity, purpose }: PollVotePageProps) {
  const [poll, setPoll] = useState<PollPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstId, setFirstId] = useState<string | null>(null);
  const [secondId, setSecondId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

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
    setFirstId(poll.yourFirstId);
    setSecondId(poll.yourSecondId);
  }, [poll, dirty]);

  const handleAdd = async (project: { label: string; people: string; url: string }) => {
    setSaving(true);
    try {
      const next = await addProjectToPoll(slug, project);
      setPoll(next);
      toast.success("You’re on the slate.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that project.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleVote = async () => {
    if (!poll || !firstId || !secondId || saving) return;
    setSaving(true);
    try {
      const next = await voteOnPoll(slug, firstId, secondId, identity?.token);
      setPoll(next);
      setDirty(false);
      toast.success("Ballot in. You can change it until voting closes.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record your vote.");
    } finally {
      setSaving(false);
    }
  };

  const theme = themeForEvent(poll?.eventTitle);
  const submitted = Boolean(poll?.yourFirstId && poll?.yourSecondId && !dirty);

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
              {purpose === "add" ? "Add your project" : poll.question}
            </h1>

            {purpose === "add" && poll.status !== "closed" ? (
              <div className="mt-4">
                <p className="mb-4 text-sm text-gray-600">
                  Name it, add the people on it, and a link if there’s a demo to open.
                </p>
                <PollProjectSubmit options={poll.options} saving={saving} onSubmit={handleAdd} />
              </div>
            ) : null}

            {purpose === "add" && poll.status === "closed" ? (
              <p className="mt-4 text-sm text-gray-600">This poll is closed.</p>
            ) : null}

            {purpose === "vote" && poll.status === "draft" ? (
              <p className="mt-4 text-sm text-gray-600">
                Voting opens when the host starts it.
              </p>
            ) : null}

            {purpose === "vote" && poll.status === "live" ? (
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  Give 2 points to your favourite and 1 point to a runner-up. One ballot on this phone.
                </p>
                {poll.options.length < 2 ? (
                  <p className="mt-4 text-sm text-gray-600">The slate needs at least two projects.</p>
                ) : (
                  <>
                    <div className="mt-4">
                      <PollBallot
                        options={poll.options}
                        firstId={firstId}
                        secondId={secondId}
                        disabled={saving}
                        onChange={(next) => {
                          setDirty(true);
                          setFirstId(next.firstId);
                          setSecondId(next.secondId);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={saving || !firstId || !secondId}
                      onClick={() => void handleVote()}
                      className="mt-4 min-h-[48px] w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
                    >
                      {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                      {submitted ? "Update your points" : "Submit your points"}
                    </Button>
                    {submitted ? (
                      <p className="mt-3 text-center text-sm text-neutral-600">
                        One ballot on this phone. Change the points and submit again until the organiser ends voting — that replaces this ballot, it does not add another.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {purpose === "vote" && poll.status === "closed" ? (
              <div className="mt-5">
                <p className="mb-4 text-sm text-gray-600">Voting has ended. Here’s who won.</p>
                <PollPodium results={poll.results} totalBallots={poll.totalVotes} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
