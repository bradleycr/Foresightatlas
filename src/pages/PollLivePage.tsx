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
  /* Projector: every row must fit — size scales with how many projects are on the slate. */
  const nameSize = `clamp(0.8rem, ${Math.min(3.2, 38 / Math.max(rows.length, 1))}vh, 2.2rem)`;
  const waiting = poll?.status === "draft";

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-8 sm:py-5 xl:px-12 xl:py-6"
      style={{ background: theme.pageBackground }}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 sm:gap-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/90 shadow-sm sm:size-14 sm:rounded-2xl">
            <img src={foresightIconUrl} alt="" className="size-6 sm:size-9" />
          </span>
          <div className="min-w-0">
            <p className={`text-sm font-semibold leading-snug sm:text-lg ${theme.kickerClass}`}>
              {theme.kicker}
            </p>
            <p className={`mt-0.5 truncate text-sm font-medium sm:text-lg ${theme.detailClass}`}>
              {theme.detail || "Live poll"}
            </p>
          </div>
        </div>
        {poll && waiting ? (
          <p className={`shrink-0 text-right leading-none ${theme.inkClass}`}>
            <span className="font-heading text-3xl font-bold tabular-nums sm:text-5xl xl:text-6xl">
              {poll.options.length}
            </span>
            <span className={`mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-sm ${theme.mutedClass}`}>
              {poll.options.length === 1 ? "project" : "projects"} on the slate
            </span>
          </p>
        ) : null}
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

      {poll && waiting ? (
        <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:mt-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-stretch lg:gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
          <div
            className={`flex min-h-0 flex-col overflow-hidden rounded-[1.35rem] border px-4 py-4 sm:rounded-[1.75rem] sm:px-7 sm:py-5 xl:px-9 xl:py-6 ${theme.ticketClass}`}
          >
            <div className="shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <p className="inline-flex items-center gap-2 rounded-full border border-[#e7d3bc] bg-[#fbf6ea] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a4b2f]">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#9a4b2f]/40" />
                    <span className="relative inline-flex size-2 rounded-full bg-[#9a4b2f]" />
                  </span>
                  Waiting room
                </p>
                <p className={`text-sm font-medium ${theme.mutedClass}`}>
                  Scan Add project if yours isn’t here · voting opens when the host says go
                </p>
              </div>
              <h1 className="font-heading mt-3 text-2xl font-bold leading-tight text-inherit sm:text-4xl xl:text-5xl">
                Voting hasn’t started yet
              </h1>
            </div>
            {rows.length === 0 ? (
              <p className={`mt-8 flex flex-1 items-center justify-center text-lg sm:text-2xl ${theme.mutedClass}`}>
                First projects will appear here as teams add them.
              </p>
            ) : (
              <ol className="mt-3 flex min-h-0 flex-1 flex-col justify-evenly overflow-hidden">
                {rows.map((option, index) => (
                  <li
                    key={option.id}
                    className="flex min-h-0 shrink items-center gap-3 border-b border-black/5 last:border-b-0 sm:gap-4"
                  >
                    <span
                      className="w-7 shrink-0 tabular-nums text-neutral-400 sm:w-9"
                      style={{ fontSize: `calc(${nameSize} * 0.55)` }}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 py-[0.15em]">
                      <p className="truncate font-semibold leading-tight" style={{ fontSize: nameSize }}>
                        {option.label}
                      </p>
                      {option.people ? (
                        <p
                          className="truncate text-neutral-600"
                          style={{ fontSize: `calc(${nameSize} * 0.45)` }}
                        >
                          {option.people}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {/* Always on stage — projector column, never pushed below the fold. */}
          <div className="flex min-h-0 shrink-0 flex-col items-center justify-center gap-2 lg:gap-3">
            <PollQrCard
              slug={poll.slug}
              question="Add your project"
              eventTitle={poll.eventTitle}
              href={getPollAddUrl(poll.slug)}
              hint="Add project"
              size="pair"
              className="w-full max-w-[14rem] lg:max-w-none"
            />
            <p className={`text-center text-xs font-medium sm:text-sm ${theme.mutedClass}`}>
              Vote QR appears when voting opens
            </p>
          </div>
        </div>
      ) : null}

      {poll && !waiting ? (
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
              <div className="mt-4 min-h-0 flex-1 overflow-hidden sm:mt-5">
                <PollPodium results={poll.results} totalBallots={poll.totalVotes} size="stage" />
              </div>
            ) : (
              <ol className="mt-3 flex min-h-0 flex-1 flex-col justify-evenly overflow-hidden">
                {rows.map((option, index) => {
                  const points = "points" in option ? option.points : 0;
                  const leading = index === 0 && points > 0 && poll.status === "live";
                  return (
                    <li
                      key={option.id}
                      className="flex min-h-0 shrink items-center gap-3 border-b border-black/5 last:border-b-0 sm:gap-6"
                    >
                      <div className="min-w-0 flex-1 py-[0.12em]">
                        <p className="truncate font-semibold leading-tight" style={{ fontSize: nameSize }}>
                          {option.label}
                          {leading ? (
                            <span className="ml-2 align-middle text-[0.45em] font-semibold uppercase tracking-[0.16em] text-[#9a4b2f] sm:ml-3">
                              Leading
                            </span>
                          ) : null}
                        </p>
                        {option.people ? (
                          <p
                            className="truncate text-neutral-600"
                            style={{ fontSize: `calc(${nameSize} * 0.45)` }}
                          >
                            {option.people}
                          </p>
                        ) : null}
                      </div>
                      {poll.status === "live" ? (
                        <p className="w-14 shrink-0 text-right leading-none sm:w-28">
                          <span
                            className="font-heading font-bold tabular-nums"
                            style={{ fontSize: `calc(${nameSize} * 1.1)` }}
                          >
                            {points}
                          </span>
                          <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-500 sm:text-xs">
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
            <>
              <div className="mt-1 flex shrink-0 items-end justify-center gap-6 border-t border-black/5 pt-3 lg:hidden">
                <PollQrCard
                  slug={poll.slug}
                  question={poll.question}
                  eventTitle={poll.eventTitle}
                  hint="Vote"
                  size="thumb"
                />
                <PollQrCard
                  slug={poll.slug}
                  question="Add your project"
                  eventTitle={poll.eventTitle}
                  href={getPollAddUrl(poll.slug)}
                  hint="Add"
                  size="thumb"
                />
              </div>
              <div className="hidden min-h-0 flex-col justify-center gap-4 lg:flex">
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
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
