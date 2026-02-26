/**
 * AppFooter — minimal framing for the whole app.
 * Single line: Foresight link, optional pipe, light copy.
 */

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="flex-shrink-0 border-t border-gray-200 bg-white/50 pt-4 pb-2 md:pt-5 md:pb-2.5">
      <div className="px-4 md:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <a
            href="https://foresight.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 underline underline-offset-2 decoration-purple-400 hover:text-purple-700 hover:decoration-purple-600 transition-colors font-medium"
          >
            Foresight Institute
          </a>
          <span className="text-gray-300" aria-hidden>
            ·
          </span>
          <span>Fellows and Grantees Map & Programming</span>
          <span className="text-gray-300" aria-hidden>
            ·
          </span>
          <span>{year}</span>
        </div>
      </div>
    </footer>
  );
}
