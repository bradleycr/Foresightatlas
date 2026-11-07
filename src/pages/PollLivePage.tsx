/**
 * The room screen. Open this on the projector and leave it.
 *
 * Projector gets a fixed two-pane board. Phones get a stacked, scrollable
 * version of the same board — just in case someone opens /live on a pocket.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import foresightIconUrl from "../assets/Foresight_RGB_Icon_Black.png?url";
import { PollCountdown } from "../components/polls/PollCountdown";
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
  const rows = poll ? (poll.results.length > 0 ? poll.results : poll.options) : [];
  const nameSize = `clamp(1rem, ${Math.min(3.4, 26 / Math.max(rows.length, 1))}vh, 2.4rem)`;

  return (
    <div
      className="flex min-h-[100svh] flex-col px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-6 lg:h-full lg:min-h-0 lg:overflow-hidden xl:px-12 xl:py-8"
      style={{ background: theme.pageBackground }}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 sm:gap-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/90 shadow-sm sm:size-14 sm:rounded-2xl">
            <img src={foresightIconUrl} alt="" className="size-6 sm:size-9" />
          </span>
          <div className="min-w-0">
            <p className={`truncate text-[10px] font-semibold uppercase tracking-[0.22em] sm:text-sm ${theme.kickerClass}`}>
              {theme.kicker}
            </p>
            <p className={`mt-0.5 truncate text-sm font-medium sm:text-lg ${theme.detailClass}`}>
              {theme.detail || "Live poll"}
            </p>
          </div>
        </div>
        {poll && poll.status !== "draft" ? (
          <p className={`shrink-0 text-right leading-none ${theme.inkClass}`}>
            <span className="font-heading text-3xl font-bold tabular-nums sm:text-5xl xl:text-6xl">
              {poll.totalVotes}
            </span>
            <span className={`mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-sm ${theme.mutedClass}`}>
              {poll.totalVotes === 1 ? "vote" : "votes"}
              {poll.status === "closed" ? " · closed" : ""}
            </span>
          </p>
        ) : null}
      </header>

      {!poll && !error ? (
        <div className="flex flex-1 items-center justify-center gap-3 py-16 text-base text-gray-600 sm:text-xl">
          <Loader2 className="size-5 animate-spin sm:size-6" />
          Loading
        </div>
      ) : null}

      {error && !poll ? (
        <div className="flex flex-1 items-center justify-center px-2 py-16">
          <p className="max-w-lg text-center text-lg text-gray-800 sm:text-2xl">{error}</p>
        </div>
      ) : null}

      {poll ? (
        <div
          className={
            poll.status === "closed"
              ? "mt-4 flex min-h-0 flex-1 flex-col sm:mt-6"
              : "mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 sm:mt-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-stretch lg:gap-8 xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-10"
          }
        >
          <div
            className={`flex min-h-0 flex-col rounded-[1.35rem] border px-4 py-4 sm:rounded-[1.75rem] sm:px-8 sm:py-6 xl:px-10 xl:py-8 ${theme.ticketClass}`}
          >
            <h1 className="shrink-0 font-heading text-2xl font-bold leading-tight text-inherit sm:text-4xl xl:text-5xl">
              {poll.status === "closed" ? "Results" : poll.question}
            </h1>
            {poll.status === "live" && poll.closesAt ? (
              <div className="mt-3 shrink-0 sm:mt-4">
                <PollCountdown closesAt={poll.closesAt} onElapsed={() => void load()} size="stage" />
              </div>
            ) : null}
            {poll.status === "closed" ? (
              <div className="mt-4 min-h-0 flex-1 overflow-y-auto sm:mt-6 lg:overflow-hidden">
                <PollPodium results={poll.results} totalBallots={poll.totalVotes} size="stage" />
              </div>
            ) : (
              <ol className="mt-3 flex min-h-0 flex-1 flex-col justify-start overflow-y-auto sm:mt-4 lg:justify-center lg:overflow-hidden">
                {rows.map((option, index) => {
                  const points = "points" in option ? option.points : 0;
                  const leading = index === 0 && points > 0 && poll.status === "live";
                  return (
                    <li
                      key={option.id}
                      className="flex items-center gap-3 border-b border-black/5 py-[0.45em] last:border-b-0 sm:gap-6 sm:py-[0.35em]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-tight sm:truncate" style={{ fontSize: nameSize }}>
                          {option.label}
                          {leading ? (
                            <span className="ml-2 align-middle text-[0.45em] font-semibold uppercase tracking-[0.16em] text-[#9a4b2f] sm:ml-3">
                              Leading
                            </span>
                          ) : null}
                        </p>
                        {option.people ? (
                          <p
                            className="mt-0.5 text-neutral-600 sm:truncate"
                            style={{ fontSize: `calc(${nameSize} * 0.48)` }}
                          >
                            {option.people}
                          </p>
                        ) : null}
                      </div>
                      {poll.status === "live" ? (
                        <p className="w-14 shrink-0 text-right leading-none sm:w-28">
                          <span
                            className="font-heading font-bold tabular-nums"
                            style={{ fontSize: `calc(${nameSize} * 1.15)` }}
                          >
                            {points}
                          </span>
                          <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-500 sm:mt-1 sm:text-xs">
                            pts
                          </span>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          {poll.status === "closed" ? null : (
            <div className="grid shrink-0 grid-cols-2 gap-3 lg:flex lg:min-h-0 lg:flex-col lg:justify-center lg:gap-4">
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
                hint="Add project"
                size="pair"
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
