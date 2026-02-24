import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import foresightLogo from "../assets/Foresight_RGB_Logo_Black.png?url";
import { Z_INDEX_SIDEBAR } from "../constants/zIndex";

interface AppHeaderProps {
  activeTab: "map" | "timeline";
  onTabChange: (tab: "map" | "timeline") => void;
  suggestFormUrl?: string;
  onNavigateNode?: (slug: string) => void;
}

export function AppHeader({
  activeTab,
  onTabChange,
  suggestFormUrl,
  onNavigateNode,
}: AppHeaderProps) {
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nodeMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setNodeMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [nodeMenuOpen]);

  return (
    <header
      className="border-b border-gray-200 relative bg-app-header"
      style={{ zIndex: Z_INDEX_SIDEBAR + 100 }}
    >
      <div className="px-4 md:px-8 py-4 md:py-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <img src={foresightLogo} alt="Foresight Institute" className="h-9 md:h-12" />
            <div className="border-l border-gray-300 pl-3 md:pl-4">
              <h1 className="text-gray-900 text-sm md:text-xl font-heading">
                Fellows and Grantees Map & Timeline
              </h1>
              <p className="text-xs md:text-sm text-gray-600 hidden sm:block">
                Tracking our global network of Fellows, Grantees, and prize winners
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex gap-1 sm:gap-2">
              <button
                onClick={() => onTabChange("map")}
                className={`px-4 py-2 rounded-lg transition-all text-sm sm:text-base border ${
                  activeTab === "map"
                    ? "text-gray-900 shadow-sm border-white/50 bg-app-tab-active"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-transparent"
                }`}
              >
                Map
              </button>

              {/* Node Programming dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setNodeMenuOpen(!nodeMenuOpen)}
                  className={`px-4 py-2 rounded-lg transition-all text-sm sm:text-base border inline-flex items-center gap-1.5 ${
                    nodeMenuOpen
                      ? "text-gray-900 bg-gray-100 border-gray-200"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <span className="hidden sm:inline">Programming</span>
                  <span className="sm:hidden">Nodes</span>
                  <ChevronDown
                    className={`size-4 transition-transform duration-200 ${nodeMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {nodeMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-44 rounded-xl bg-white border border-gray-200 shadow-xl py-1.5"
                    style={{
                      zIndex: Z_INDEX_SIDEBAR + 200,
                      animation: "fadeInDown 120ms ease-out",
                    }}
                  >
                    <button
                      onClick={() => {
                        onNavigateNode?.("berlin");
                        setNodeMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    >
                      Berlin
                    </button>
                    <button
                      onClick={() => {
                        onNavigateNode?.("sf");
                        setNodeMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    >
                      San Francisco
                    </button>
                  </div>
                )}
              </div>
            </div>

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
