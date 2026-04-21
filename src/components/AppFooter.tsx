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
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <div className="px-4 md:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <a
            href="https://foresight.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-600 underline underline-offset-2 decoration-teal-400 hover:text-teal-700 hover:decoration-teal-600 transition-colors font-medium"
          >
            Foresight Institute
          </a>
          <span className="text-gray-300" aria-hidden>
            ·
          </span>
          <span>Foresight map &amp; Node programming</span>
          <span className="text-gray-300" aria-hidden>
            ·
          </span>
          <span>{year}</span>
        </div>
      </div>
    </footer>
  );
}
