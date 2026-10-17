/**
 * AppFooter — desktop-only utility line.
 * Hidden on mobile so the map and forms get the full viewport (tool-app pattern).
 */

import { FORESIGHT_ORG_URL } from "../constants/foresight";

interface AppFooterProps {
  onNavigateHome?: () => void;
}

export function AppFooter({ onNavigateHome }: AppFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="hidden shrink-0 border-t border-gray-200 bg-white/80 py-2 md:block">
      <div className="px-4 md:px-8">
        <p className="mx-auto max-w-2xl text-center text-xs leading-none text-gray-500">
          <a
            href={FORESIGHT_ORG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-teal-600 underline decoration-teal-400/80 underline-offset-2 transition-colors hover:text-teal-700"
          >
            Foresight Institute
          </a>
          <span className="text-gray-300" aria-hidden>
            {" "}
            ·{" "}
          </span>
          {onNavigateHome ? (
            <button
              type="button"
              onClick={onNavigateHome}
              className="transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 rounded-sm"
            >
              The Foresight Atlas
            </button>
          ) : (
            <span>The Foresight Atlas</span>
          )}
          <span className="text-gray-300" aria-hidden>
            {" "}
            ·{" "}
          </span>
          <span className="tabular-nums">{year}</span>
        </p>
      </div>
    </footer>
  );
}
