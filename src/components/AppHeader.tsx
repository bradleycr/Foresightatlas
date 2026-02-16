import { Button } from "./ui/button";
import foresightLogo from "../assets/Foresight_RGB_Logo_Black.png?url";

interface AppHeaderProps {
  activeTab: "map" | "timeline";
  onTabChange: (tab: "map" | "timeline") => void;
  nodeQuickActions?: Array<{ label: string; onClick: () => void }>;
  suggestFormUrl?: string;
}

export function AppHeader({
  activeTab,
  onTabChange,
  nodeQuickActions,
  suggestFormUrl,
}: AppHeaderProps) {
  return (
    <header
      className="border-b border-gray-200"
      style={{
        background: "linear-gradient(to bottom, #ffffff 0%, #fafafa 100%)",
      }}
    >
      <div className="px-4 md:px-8 py-4 md:py-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <img src={foresightLogo} alt="Foresight Institute" className="h-9 md:h-12" />
            <div className="border-l border-gray-300 pl-3 md:pl-4">
              <h1
                className="text-gray-900 text-sm md:text-xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Fellows and Grantees Map & Timeline
              </h1>
              <p className="text-xs md:text-sm text-gray-600 hidden sm:block">
                Tracking our global network of Fellows, Grantees, and prize winners
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {/* Tabs */}
            <div className="flex gap-1 sm:gap-2">
              <button
                onClick={() => onTabChange("map")}
                className={`px-4 py-2 rounded-lg transition-all text-sm sm:text-base border ${
                  activeTab === "map"
                    ? "text-gray-900 shadow-sm border-white/50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-transparent"
                }`}
                style={
                  activeTab === "map"
                    ? { background: "linear-gradient(135deg, #bfdbfe 0%, #c4b5fd 100%)" }
                    : undefined
                }
              >
                Map
              </button>
              <button
                disabled
                aria-disabled="true"
                className="px-4 py-2 rounded-lg text-sm sm:text-base border border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
              >
                Timeline · Coming soon
              </button>
            </div>

            {nodeQuickActions && nodeQuickActions.length > 0 && (
              <div className="flex items-center gap-2">
                {nodeQuickActions.map((action) => (
                  <Button
                    key={action.label}
                    onClick={action.onClick}
                    variant="outline"
                    size="sm"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}

            {/* Suggest an update — links to external form (swap URL when ready) */}
            {suggestFormUrl && (
              <a
                href={suggestFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
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
