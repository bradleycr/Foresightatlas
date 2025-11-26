import { Button } from "./ui/button";
import foresightLogo from "../assets/Foresight_RGB_Logo_Black.png?url";

interface AppHeaderProps {
  activeTab: "map" | "timeline";
  onTabChange: (tab: "map" | "timeline") => void;
  isAdmin: boolean;
  adminName?: string;
  onAdminClick: () => void;
  onLogout: () => void;
  onAdminPanelClick: () => void;
  onSuggestUpdateClick: () => void;
}

export function AppHeader({
  activeTab,
  onTabChange,
  isAdmin,
  adminName,
  onAdminClick,
  onLogout,
  onAdminPanelClick,
  onSuggestUpdateClick,
}: AppHeaderProps) {
  return (
    <header 
      className="border-b border-gray-200"
      style={{
        background: 'linear-gradient(to bottom, #ffffff 0%, #fafafa 100%)'
      }}
    >
      <div className="px-4 md:px-8 py-4 md:py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 md:mb-6">
          <div className="flex items-center gap-3 md:gap-4">
            <img src={foresightLogo} alt="Foresight Institute" className="h-9 md:h-14" />
            <div className="border-l border-gray-300 pl-3 md:pl-4">
              <h1 className="text-gray-900 text-sm md:text-lg" style={{ fontFamily: 'var(--font-heading)' }}>
                Fellows and Grantees Map & Timeline
              </h1>
              <p className="text-xs md:text-xs text-gray-600 hidden sm:block">
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
                    ? { background: 'linear-gradient(135deg, #bfdbfe 0%, #c4b5fd 100%)' }
                    : undefined
                }
              >
                Map
              </button>
              <button
                onClick={() => onTabChange("timeline")}
                className={`px-4 py-2 rounded-lg transition-all text-sm sm:text-base border ${
                  activeTab === "timeline"
                    ? "text-gray-900 shadow-sm border-white/50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-transparent"
                }`}
                style={
                  activeTab === "timeline"
                    ? { background: 'linear-gradient(135deg, #bfdbfe 0%, #c4b5fd 100%)' }
                    : undefined
                }
              >
                Timeline
              </button>
            </div>

            {/* Admin Section */}
            {!isAdmin ? (
              <div className="flex items-center gap-2">
                <Button
                  onClick={onSuggestUpdateClick}
                  variant="outline"
                  size="sm"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <span className="hidden sm:inline">Suggest an update</span>
                  <span className="sm:hidden">Suggest</span>
                </Button>
                <Button
                  onClick={onAdminClick}
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700 text-xs"
                >
                  Admin
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-sm text-gray-600 hidden md:inline">{adminName}</span>
                <Button
                  onClick={onAdminPanelClick}
                  variant="outline"
                  size="sm"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 hidden sm:inline-flex"
                >
                  Updates Panel
                </Button>
                <Button
                  onClick={onAdminPanelClick}
                  variant="outline"
                  size="sm"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 sm:hidden"
                >
                  Updates
                </Button>
                <Button
                  onClick={onLogout}
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-900"
                >
                  <span className="hidden md:inline">Log out</span>
                  <span className="md:hidden">Out</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}