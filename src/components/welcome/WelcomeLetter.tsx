/**
 * WelcomeLetter — a single note from the team, shown once.
 *
 * The atlas stays on screen behind a soft veil, the way a letter is read
 * with the room still visible. The demo plays in this same window: closing
 * the player returns to the note, and the note returns to the map.
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { Bug, ChevronLeft, Play } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog@1.1.6";
import foresightIconUrl from "../../assets/Foresight_RGB_Icon_Black.png?url";
import { ATLAS_DEMO_URL } from "../../constants/foresight";
import { Z_INDEX_WELCOME } from "../../constants/zIndex";
import { Dialog, DialogOverlay, DialogPortal } from "../ui/dialog";

interface WelcomeLetterProps {
  fullName: string;
  onDismiss: () => void;
}

function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first || "";
}

export function WelcomeLetter({ fullName, onDismiss }: WelcomeLetterProps) {
  const exploreRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const name = firstName(fullName);

  useEffect(() => {
    if (playing) backRef.current?.focus();
    else exploreRef.current?.focus();
  }, [playing]);

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onDismiss(); }}>
      <DialogPortal>
        <DialogOverlay
          className={
            playing
              ? "bg-slate-950/75 backdrop-blur-md"
              : "bg-slate-900/25 backdrop-blur-[3px]"
          }
          style={{ zIndex: Z_INDEX_WELCOME }}
        />
        <DialogPrimitive.Content
          aria-describedby={playing ? undefined : "atlas-welcome-body"}
          className={`data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border border-white/80 shadow-[0_30px_80px_-24px_rgba(15,23,42,0.45)] outline-none duration-200 ${
            playing
              ? "h-[min(100dvh-1rem,46rem)] w-[min(68rem,calc(100vw-1rem))] rounded-2xl bg-slate-950 sm:rounded-[1.75rem]"
              : "max-h-[min(100dvh-1.5rem,44rem)] w-[min(36rem,calc(100vw-1.5rem))] rounded-[1.75rem] bg-[#fbfaf7]"
          }`}
          style={{
            zIndex: Z_INDEX_WELCOME + 1,
            marginTop: "env(safe-area-inset-top, 0px)",
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (playing ? backRef : exploreRef).current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (!playing) return;
            event.preventDefault();
            setPlaying(false);
          }}
          onPointerDownOutside={(event) => {
            if (!playing) return;
            event.preventDefault();
            setPlaying(false);
          }}
        >
          {playing ? (
            <AtlasDemoPlayer backRef={backRef} onBack={() => setPlaying(false)} />
          ) : (
          <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-7 pb-2 sm:px-10 sm:pt-9">
            <img
              src={foresightIconUrl}
              alt=""
              className="size-9 object-contain opacity-80"
              aria-hidden
            />

            <p className="mt-6 text-[0.68rem] font-medium tracking-[0.22em] text-sky-800/70 uppercase">
              A note from the team
            </p>
            <DialogPrimitive.Title
              className="mt-2 text-[1.85rem] leading-tight font-normal tracking-tight text-slate-900 sm:text-[2.15rem]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Welcome to the Atlas
            </DialogPrimitive.Title>

            <div
              id="atlas-welcome-body"
              className="mt-5 space-y-4 text-[0.95rem] leading-7 text-slate-700"
            >
              {name ? (
                <p style={{ fontFamily: "var(--font-heading)" }} className="text-slate-900">
                  Dear {name},
                </p>
              ) : null}
              <p>
                We built The Foresight Atlas as an internal tool for grantees,
                fellows, and our new nodees, so you can find one another and
                keep a pulse on what is happening at our nodes in San Francisco
                and Berlin.
              </p>
              <p>We hope it brings you value.</p>
              <p>
                It is new, and still in beta. If you run into a problem, or if
                there is a feature you would really like to see, tap the small
                bug{" "}
                <span
                  className="mx-0.5 inline-grid size-[1.35rem] translate-y-[-1px] place-items-center rounded-md border border-gray-300 bg-white align-middle text-gray-600 shadow-sm"
                  aria-hidden
                >
                  <Bug className="size-3 translate-x-px" />
                </span>{" "}
                in the corner of any page.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200/70 bg-[#fbfaf7]/95 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-10"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
          >
            <p
              className="hidden text-sm text-slate-500 sm:block"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              With care, the Foresight team
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:ring-offset-2"
              >
                <Play className="size-3.5 fill-current" aria-hidden />
                Watch the demo in under 4 minutes
              </button>
              <button
                ref={exploreRef}
                type="button"
                onClick={onDismiss}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:ring-offset-2"
              >
                Explore on your own
              </button>
            </div>
            <p
              className="text-center text-sm text-slate-500 sm:hidden"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              With care, the Foresight team
            </p>
          </div>
          </>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/**
 * The Zoom recording, framed inside the letter.
 * Closing it only leaves the player. The atlas tab never changes.
 */
function AtlasDemoPlayer({
  backRef,
  onBack,
}: {
  backRef: RefObject<HTMLButtonElement | null>;
  onBack: () => void;
}) {
  const [ready, setReady] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950 text-white">
      <div
        className="flex items-center gap-2 border-b border-white/10 px-3 py-2 sm:gap-3 sm:px-4"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}
      >
        <button
          ref={backRef}
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium text-white/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Back to the note
        </button>
        <DialogPrimitive.Title className="min-w-0 truncate text-sm font-medium tracking-tight text-white/70 sm:text-base">
          The Atlas, in under 4 minutes
        </DialogPrimitive.Title>
      </div>

      <div
        className="relative min-h-0 flex-1 bg-black"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {ready ? null : (
          <p className="absolute inset-0 z-10 grid place-items-center bg-black text-sm text-white/70">
            Opening the recording…
          </p>
        )}
        <iframe
          src={ATLAS_DEMO_URL}
          title="Foresight Atlas demo recording"
          className="absolute inset-0 z-0 h-full w-full border-0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          onLoad={() => setReady(true)}
        />
      </div>
    </div>
  );
}
