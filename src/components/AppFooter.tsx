/**
 * AppFooter — minimal framing for the whole app.
 * Single line: Foresight link, optional pipe, light copy.
 */

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="flex-shrink-0 border-t border-gray-200 bg-white/50 pt-4 pb-2 md:pt-5 md:pb-2.5"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px) + 0.5rem)",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
      }}
    >
      <div className="px-3 sm:px-4 md:px-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-y-2 text-center text-[11px] leading-snug text-gray-500 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-2.5 sm:gap-y-1.5 sm:text-xs sm:leading-normal">
          <a
            href="https://foresight.org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-teal-600 underline decoration-teal-400 underline-offset-2 transition-colors hover:text-teal-700 hover:decoration-teal-600"
          >
            Foresight Institute
          </a>
          <span className="hidden text-gray-300 sm:inline" aria-hidden>
            ·
          </span>
          <span className="text-pretty">
            The Foresight Atlas
            <span className="ml-1.5 inline-block rounded-full border border-stone-200/80 bg-gradient-to-b from-white to-stone-50/95 px-1.5 py-px text-[9px] font-medium tracking-tight text-stone-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:text-[10px]">
              (beta)
            </span>
          </span>
          <span className="hidden text-gray-300 sm:inline" aria-hidden>
            ·
          </span>
          <span className="tabular-nums text-gray-500">{year}</span>
        </div>
      </div>
    </footer>
  );
}
