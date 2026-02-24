import { CalendarDays } from "lucide-react";
import foresightLogo from "../assets/Foresight_RGB_Logo_Black.png?url";

interface AppHeaderProps {
  activeTab: "map" | "timeline";
  onTabChange: (tab: "map" | "timeline") => void;
  suggestFormUrl?: string;
  onProgramNavigate?: () => void;
}

export function AppHeader({
  activeTab,
  onTabChange,
  suggestFormUrl,
  onProgramNavigate,
}: AppHeaderProps) {
  return (
    <header className="app-header-shell border-b border-gray-200">
      <div className="px-4 md:px-8 py-4 md:py-5">
        <div className="flex flex-col gap-4 md:gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 md:gap-4 min-w-0">
              <img
                src={foresightLogo}
                alt="Foresight Institute"
                className="h-9 md:h-12 shrink-0"
              />
              <div className="border-l border-gray-300 pl-3 md:pl-4 min-w-0">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Foresight Institute
                </p>
                <h1
                  className="text-gray-900 text-sm md:text-xl"
                  style={{ fontFamily: "var(--font-heading)", lineHeight: 1.2 }}
                >
                  Fellows and Grantees Map & Timeline
                </h1>
                <p className="text-xs md:text-sm text-gray-600 hidden sm:block mt-1">
                  Explore people, projects, and travel activity across nodes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {onProgramNavigate && (
                <button
                  type="button"
                  onClick={onProgramNavigate}
                  className="app-program-link"
                >
                  <CalendarDays className="size-4" />
                  Program 2026
                </button>
              )}
              {suggestFormUrl && (
                <a
                  href={suggestFormUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="app-program-link"
                >
                  <span className="hidden sm:inline">Suggest an update</span>
                  <span className="sm:hidden">Suggest</span>
                </a>
              )}
            </div>
          </div>

          <div className="app-segmented-control w-fit">
            <button
              type="button"
              onClick={() => onTabChange("map")}
              className={`app-segmented-control__button ${
                activeTab === "map" ? "is-active" : ""
              }`}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => onTabChange("timeline")}
              className={`app-segmented-control__button ${
                activeTab === "timeline" ? "is-active" : ""
              }`}
            >
              Timeline
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
