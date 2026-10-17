/**
 * Forgotten-password landing. Self-serve magic links are paused — this page
 * only opens the member's mail app so the team can send a fresh link.
 */

import { ArrowLeft, Mail } from "lucide-react";
import foresightIconUrl from "../assets/Foresight_RGB_Icon_Black.png?url";
import { FORESIGHT_ORG_URL } from "../constants/foresight";
import { atlasPasswordResetMailto } from "../utils/checkInAuth";

const PAGE_BG =
  "linear-gradient(180deg, #f7f6f3 0%, #ffffff 42%, #f3f1ec 100%)";

interface AccessPageProps {
  onNavigateHome: () => void;
}

export function AccessPage({ onNavigateHome }: AccessPageProps) {
  return (
    <div
      className="flex min-h-[100svh] flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 sm:min-h-[100dvh] sm:items-center sm:px-5 sm:py-10"
      style={{ background: PAGE_BG }}
    >
      <div className="mx-auto w-full max-w-md">
        <button
          type="button"
          onClick={onNavigateHome}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-neutral-600 hover:text-[var(--primary)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </button>

        <div className="mt-6 mb-6 flex items-center gap-3">
          <a
            href={FORESIGHT_ORG_URL}
            target="_blank"
            rel="noreferrer"
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white shadow-sm"
          >
            <img src={foresightIconUrl} alt="Foresight Institute" className="size-6" />
          </a>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              The Foresight Atlas
            </p>
            <h1 className="font-heading text-xl font-bold text-[var(--primary)]">
              Forgot your password?
            </h1>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-neutral-200/90 bg-white p-5 shadow-[0_1px_0_rgba(3,2,19,0.04)] sm:p-7">
          <p className="text-sm leading-relaxed text-neutral-600">
            Email our team and we’ll send a new magic link so you can choose a
            password. Use the name we have on the directory so we can find you.
          </p>
          <a
            href={atlasPasswordResetMailto()}
            className="mt-5 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90"
          >
            <Mail className="size-4" aria-hidden />
            Email our team
          </a>
        </div>
      </div>
    </div>
  );
}
