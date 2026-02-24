/**
 * App Header
 *
 * Top-level navigation bar with logo, title, and view tabs.
 * Adapts gracefully to mobile widths.
 */

import foresightLogo from "../assets/Foresight_RGB_Logo_Black.png?url";

interface AppHeaderProps {
  activeTab: "map" | "timeline";
  onTabChange: (tab: "map" | "timeline") => void;
  suggestFormUrl?: string;
}

export function AppHeader({
  activeTab,
  onTabChange,
  suggestFormUrl,
}: AppHeaderProps) {
  return (
    <header
      className="border-b border-gray-100"
      style={{
        background: "linear-gradient(to bottom, #ffffff 0%, #fafafa 100%)",
      }}
    >
      <div className="px-4 md:px-8 py-3.5 md:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Left: logo + title */}
          <div className="flex items-center gap-3 md:gap-4">
            <img
              src={foresightLogo}
              alt="Foresight Institute"
              className="h-8 md:h-10"
            />
            <div className="border-l border-gray-200 pl-3 md:pl-4">
              <h1
                className="text-gray-900 text-sm md:text-lg font-semibold leading-tight"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Fellows & Grantees
              </h1>
              <p className="text-[10px] md:text-xs text-gray-400 hidden sm:block mt-0.5">
                Tracking our global network of Fellows, Grantees and prize winners
              </p>
            </div>
          </div>

          {/* Right: tabs + optional suggest link */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex gap-1 bg-gray-100/80 p-0.5 rounded-lg">
              <button
                onClick={() => onTabChange("map")}
                className={`px-3 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${
                  activeTab === "map"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Map
              </button>
              <button
                disabled
                aria-disabled="true"
                className="px-3 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-medium text-gray-300 cursor-not-allowed"
              >
                Timeline
              </button>
            </div>

            {suggestFormUrl && (
              <a
                href={suggestFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-200 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="hidden sm:inline">Suggest an update</span>
                <span className="sm:hidden">Suggest</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
