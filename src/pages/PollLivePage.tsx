/**
 * The room screen. Open this on the projector and leave it.
 *
 * Nothing here is a link: nobody is at the glass. Names and points are
 * sized for the back row, and the two codes are large enough to scan
 * from a seat.
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
  const nameSize = `clamp(1.15rem, ${Math.min(3.4, 26 / Math.max(rows.length, 1))}vh, 2.4rem)`;

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden px-8 py-6 xl:px-12 xl:py-8"
      style={{ background: theme.pageBackground }}
    >
      <header className="flex shrink-0 items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/90 shadow-sm">
            <img src={foresightIconUrl} alt="" className="size-9" />
          </span>
          <div className="min-w-0">
            <p className={`truncate text-sm font-semibold uppercase tracking-[0.22em] ${theme.kickerClass}`}>
              {theme.kicker}
            </p>
            <p className={`mt-0.5 truncate text-lg font-medium ${theme.detailClass}`}>
              {theme.detail || "Live poll"}
            </p>
          </div>
        </div>
        {poll && poll.status !== "draft" ? (
          <p className={`shrink-0 text-right leading-none ${theme.inkClass}`}>
            <span className="font-heading text-5xl font-bold tabular-nums xl:text-6xl">{poll.totalVotes}</span>
            <span className={`mt-1 block text-sm font-semibold uppercase tracking-[0.18em] ${theme.mutedClass}`}>
              {poll.totalVotes === 1 ? "vote" : "votes"}
              {poll.status === "closed" ? " · closed" : ""}
            </span>
          </p>
        ) : null}
      </header>

      {!poll && !error ? (
        <div className="flex flex-1 items-center justify-center gap-3 text-xl text-gray-600">
          <Loader2 className="size-6 animate-spin" />
          Loading
        </div>
      ) : null}

      {error && !poll ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="max-w-lg text-center text-2xl text-gray-800">{error}</p>
        </div>
      ) : null}

      {poll ? (
        <div
          className={
            poll.status === "closed"
              ? "mt-6 flex min-h-0 flex-1"
              : "mt-6 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_22rem] items-stretch gap-8 xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-10"
          }
        >
          <div className={`flex min-h-0 flex-col rounded-[1.75rem] border px-8 py-6 xl:px-10 xl:py-8 ${theme.ticketClass}`}>
            <h1 className="shrink-0 font-heading text-4xl font-bold leading-tight text-inherit xl:text-5xl">
              {poll.question}
            </h1>
            {poll.status === "live" && poll.closesAt ? (
              <div className="mt-4 shrink-0">
                <PollCountdown closesAt={poll.closesAt} onElapsed={() => void load()} size="stage" />
              </div>
            ) : null}
            {poll.status === "closed" ? (
              <div className="mt-6 min-h-0 flex-1 overflow-hidden">
                <PollPodium results={poll.results} totalBallots={poll.totalVotes} size="stage" />
              </div>
            ) : (
              <ol className="mt-4 flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
                {rows.map((option, index) => {
                  const points = "points" in option ? option.points : 0;
                  const leading = index === 0 && points > 0 && poll.status === "live";
                  return (
                    <li key={option.id} className="flex items-center gap-6 border-b border-black/5 py-[0.35em] last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold leading-tight" style={{ fontSize: nameSize }}>
                          {option.label}
                          {leading ? (
                            <span className="ml-3 align-middle text-[0.45em] font-semibold uppercase tracking-[0.16em] text-[#9a4b2f]">
                              Leading
                            </span>
                          ) : null}
                        </p>
                        {option.people ? (
                          <p className="mt-0.5 truncate text-neutral-600" style={{ fontSize: `calc(${nameSize} * 0.48)` }}>
                            {option.people}
                          </p>
                        ) : null}
                      </div>
                      {poll.status === "live" ? (
                        <p className="w-28 shrink-0 text-right leading-none">
                          <span className="font-heading font-bold tabular-nums" style={{ fontSize: `calc(${nameSize} * 1.15)` }}>
                            {points}
                          </span>
                          <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
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
          {poll.status === "closed" ? null : (
            <div className="flex min-h-0 flex-col justify-center gap-4">
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
          )}
        </div>
      ) : null}
    </div>
  );
}
