/**
 * Projector / stage display for a live poll.
 *
 * Large question + live bars on the left, high-contrast QR on the right so
 * the room can join without typing a URL. Polls the API every few seconds.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import foresightIconUrl from "../assets/Foresight_RGB_Icon_Black.png?url";
import { FORESIGHT_ORG_URL } from "../constants/foresight";
import { PollPodium } from "../components/polls/PollPodium";
import { PollQrCard } from "../components/polls/PollQrCard";
import { themeForEvent } from "../components/polls/pollEventTheme";
import { fetchPublicPoll } from "../services/polls";
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
    }, 8000);
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
              : `${poll.totalVotes} ballot${poll.totalVotes === 1 ? "" : "s"}${poll.status === "closed" ? " · closed" : ""}`}
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
        <div className="mt-8 grid flex-1 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
          <div className={`rounded-[1.75rem] border p-6 sm:p-8 ${theme.ticketClass}`}>
            <h1 className="font-heading text-2xl font-bold leading-tight text-inherit sm:text-4xl lg:text-5xl">
              {poll.question}
            </h1>
            {poll.status === "closed" ? (
              <div className="mt-8">
                <PollPodium results={poll.results} totalBallots={poll.totalVotes} size="stage" />
              </div>
            ) : (
              <div className="mt-6">
                <p className="text-sm text-neutral-600 sm:text-base">
                  {poll.status === "draft"
                    ? "Add your project from the QR. Voting opens when the host starts it."
                    : "Scores stay hidden until voting closes. A favourite is 2 points, a runner-up is 1."}
                </p>
                {poll.status === "draft" && poll.options.length > 0 ? (
                  <ul className="mt-6 divide-y divide-black/5">
                    {poll.options.map((option) => (
                      <li key={option.id} className="py-3">
                        <p className="text-lg font-medium">{option.label}</p>
                        {option.people ? (
                          <p className="text-sm text-neutral-600">{option.people}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
          <PollQrCard
            slug={poll.slug}
            question={poll.question}
            eventTitle={poll.eventTitle}
            hint={poll.status === "draft" ? "Scan to add your project" : "Scan to vote"}
            size="stage"
            className="lg:sticky lg:top-8"
          />
        </div>
      ) : null}
    </div>
  );
}
