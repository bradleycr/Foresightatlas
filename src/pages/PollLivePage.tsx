/**
 * Projector / stage display for a live poll.
 *
 * Large question + live bars on the left, high-contrast QR on the right so
 * the room can join without typing a URL. Polls the API every few seconds.
 */

import { useCallback, useEffect, useState } from "react";
import { Github, Loader2 } from "lucide-react";
import foresightIconUrl from "../assets/Foresight_RGB_Icon_Black.png?url";
import { FORESIGHT_ORG_URL } from "../constants/foresight";
import { PollPodium } from "../components/polls/PollPodium";
import { PollQrCard } from "../components/polls/PollQrCard";
import { themeForEvent } from "../components/polls/pollEventTheme";
import { fetchPublicPoll } from "../services/polls";
import { getPollAddUrl } from "../utils/pollUrls";
import { subscribeToDataChanges } from "../services/sync";
import type { PollPublic } from "../types/polls";

interface PollLivePageProps {
  slug: string;
}

export function PollLivePage({ slug }: PollLivePageProps) {
  const [poll, setPoll] = useState<PollPublic | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await fetchPublicPoll(slug);
      setPoll(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "This poll is not available.");
    }
  }, [slug]);

  useEffect(() => {
    void load();
    const unsub = subscribeToDataChanges((msg) => {
      if (msg.scope === "polls" || msg.scope === "all") void load();
    });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void load();
    }, 4000);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, [load]);

  const theme = themeForEvent(poll?.eventTitle);

  return (
    <div
      className="flex min-h-[100svh] flex-col px-6 py-8 sm:min-h-[100dvh] sm:px-10 sm:py-10"
      style={{ background: theme.pageBackground }}
    >
      <header className="flex items-start justify-between gap-3">
        <a
          href={FORESIGHT_ORG_URL}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 items-center gap-3"
        >
          <span className="flex size-11 items-center justify-center rounded-2xl border border-white/80 bg-white/90 shadow-sm">
            <img src={foresightIconUrl} alt="" className="size-7" />
          </span>
          <div>
            <p className={`text-[11px] font-semibold uppercase leading-snug tracking-[0.16em] sm:tracking-[0.22em] ${theme.kickerClass}`}>
              {theme.kicker}
            </p>
            <p className={`text-sm font-medium ${theme.detailClass}`}>
              {theme.detail || "Live poll"}
            </p>
          </div>
        </a>
        {poll ? (
          <p className={`shrink-0 text-right text-sm tabular-nums ${theme.mutedClass}`}>
            {poll.status === "draft"
              ? `${poll.options.length} project${poll.options.length === 1 ? "" : "s"}`
              : `${poll.totalVotes} vote${poll.totalVotes === 1 ? "" : "s"}${poll.status === "closed" ? " · closed" : ""}`}
          </p>
        ) : null}
      </header>

      {!poll && !error ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-gray-600">
          <Loader2 className="size-5 animate-spin" />
          Loading live poll…
        </div>
      ) : null}

      {error && !poll ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="max-w-md text-center text-gray-700">{error}</p>
        </div>
      ) : null}

      {poll ? (
        <div className="mt-8 grid flex-1 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
          <div className={`rounded-[1.75rem] border p-6 sm:p-8 ${theme.ticketClass}`}>
            <h1 className="font-heading text-2xl font-bold leading-tight text-inherit sm:text-4xl lg:text-5xl">
              {poll.question}
            </h1>
            {poll.status === "closed" ? (
              <div className="mt-8">
                <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Winners
                </p>
                <PollPodium results={poll.results} totalBallots={poll.totalVotes} size="stage" />
              </div>
            ) : (
              <ol className="mt-6 space-y-3">
                {(poll.results.length > 0 ? poll.results : poll.options).map((option, index) => {
                  const points = "points" in option ? option.points : 0;
                  const leading = index === 0 && points > 0 && poll.status === "live";
                  return (
                    <li key={option.id} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-medium leading-snug sm:text-xl">
                          {option.label}
                          {leading ? (
                            <span className="ml-2 align-middle text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a4b2f]">
                              Leading
                            </span>
                          ) : null}
                        </p>
                        {option.people ? (
                          <p className="text-sm text-neutral-600">{option.people}</p>
                        ) : null}
                      </div>
                      {option.url ? (
                        <a
                          href={option.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex size-10 shrink-0 items-center justify-center text-neutral-800"
                          aria-label={`${option.label} on GitHub`}
                        >
                          <Github className="size-5" />
                        </a>
                      ) : null}
                      {poll.status === "live" ? (
                        <p className="w-14 shrink-0 text-right leading-none">
                          <span className="text-2xl font-bold tabular-nums">{points}</span>
                          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                            points
                          </span>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          <div className="flex flex-col gap-4 lg:sticky lg:top-8">
            <PollQrCard
              slug={poll.slug}
              question={poll.question}
              eventTitle={poll.eventTitle}
              hint="Vote"
              size="pair"
            />
            <PollQrCard
              slug={poll.slug}
              question="Add your project"
              eventTitle={poll.eventTitle}
              href={getPollAddUrl(poll.slug)}
              hint="Add your project"
              size="pair"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
