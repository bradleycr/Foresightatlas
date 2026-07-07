/**
 * AppFooter — minimal framing for the whole app.
 * One compact line on mobile; full line on larger screens.
 */

import { FORESIGHT_ORG_URL } from "../constants/foresight";

interface AppFooterProps {
  onNavigateHome?: () => void;
}

export function AppFooter({ onNavigateHome }: AppFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className="shrink-0 border-t border-gray-200 bg-white/50 py-1.5 md:py-2"
      style={{
        paddingBottom: "max(0.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.25rem))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
      }}
    >
      <div className="px-3 sm:px-4 md:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-x-1.5 overflow-hidden text-center text-[10px] leading-tight text-gray-500 whitespace-nowrap sm:gap-x-2 sm:text-xs sm:leading-normal">
          <a
            href={FORESIGHT_ORG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-medium text-teal-600 underline decoration-teal-400 underline-offset-2 transition-colors hover:text-teal-700 hover:decoration-teal-600"
          >
            Foresight Institute
          </a>
          <span className="shrink-0 text-gray-300" aria-hidden>
            ·
          </span>
          {onNavigateHome ? (
            <button
              type="button"
              onClick={onNavigateHome}
              className="min-w-0 truncate transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 rounded-sm"
            >
              Atlas
              <span className="ml-1 inline rounded-full border border-stone-200/80 bg-gradient-to-b from-white to-stone-50/95 px-1 py-px text-[8px] font-medium tracking-tight text-stone-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:text-[9px]">
                beta
              </span>
            </button>
          ) : (
            <span className="min-w-0 truncate">
              Atlas
              <span className="ml-1 inline rounded-full border border-stone-200/80 bg-gradient-to-b from-white to-stone-50/95 px-1 py-px text-[8px] font-medium tracking-tight text-stone-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:text-[9px]">
                beta
              </span>
            </span>
          )}
          <span className="hidden shrink-0 text-gray-300 sm:inline" aria-hidden>
            ·
          </span>
          <span className="hidden shrink-0 tabular-nums text-gray-500 sm:inline">{year}</span>
        </div>
      </div>
    </footer>
  );
}
