import { useState, useRef, useEffect } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import foresightLogo from "../assets/Foresight_RGB_Logo_Black.png?url";
import { Z_INDEX_SIDEBAR, Z_INDEX_HEADER_NAV, Z_INDEX_MODAL_BACKDROP, Z_INDEX_MODAL_CONTENT } from "../constants/zIndex";

interface AppHeaderProps {
  /** Current route path: "/", "/berlin", "/sf" */
  route: string;
  /** Navigate to a path (updates history and scroll) */
  navigate: (path: string) => void;
  activeTab: "map" | "timeline";
  onTabChange: (tab: "map" | "timeline") => void;
  suggestFormUrl?: string;
}

export function AppHeader({
  route,
  navigate,
  activeTab,
  onTabChange,
  suggestFormUrl,
}: AppHeaderProps) {
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const closeNodeMenu = () => setNodeMenuOpen(false);

  const isMapRoute = route === "/";
  const isProgrammingRoute = route === "/berlin" || route === "/sf";
  const subtext = "A tool to help you connect to other grantees, fellows and nodees";

  useEffect(() => {
    if (!nodeMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setNodeMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [nodeMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node))
        setMobileMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  return (
    <header
      className="border-b border-gray-200 relative bg-app-header"
      style={{ zIndex: Z_INDEX_HEADER_NAV }}
    >
      <div className="px-4 md:px-8 py-4 md:py-5">
        <div className="flex flex-nowrap items-center justify-between gap-3 min-h-0">
          {/* Logo + title — shrinks so nav never wraps */}
          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                navigate("/");
                onTabChange("map");
              }}
              className="flex-shrink-0 flex items-center gap-3 md:gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 rounded cursor-pointer hover:opacity-90 transition-opacity"
              aria-label="Back to map"
            >
              <img src={foresightLogo} alt="Foresight Institute" className="h-9 md:h-12" />
            </button>
            <div className="border-l border-gray-300 pl-3 md:pl-4 min-w-0">
              <h1 className="text-gray-900 text-sm md:text-xl font-heading truncate">
                Grantees and Fellows Map and Programming
              </h1>
              <p className="text-xs md:text-sm text-gray-600 truncate">
                {subtext}
              </p>
            </div>
          </div>

          {/* Desktop nav — original pill-style Map + Programming */}
          <div className="header-desktop-nav flex-shrink-0 items-center gap-1 sm:gap-2">
            <button
              onClick={() => {
                navigate("/");
                if (isMapRoute) onTabChange("map");
              }}
              className={`px-4 py-2 rounded-lg transition-all text-sm sm:text-base border ${
                isMapRoute
                  ? "text-gray-900 shadow-sm border-white/50 bg-app-tab-active"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-transparent"
              }`}
            >
              Map
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setNodeMenuOpen(!nodeMenuOpen)}
                className={`px-4 py-2 rounded-lg transition-all text-sm sm:text-base border inline-flex items-center gap-1.5 ${
                  isProgrammingRoute && !nodeMenuOpen
                    ? "text-gray-900 shadow-sm border-white/50 bg-app-tab-active"
                    : nodeMenuOpen
                      ? "text-gray-900 bg-gray-100 border-gray-200"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                Programming
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
                      navigate("/berlin");
                      setNodeMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    Berlin
                  </button>
                  <button
                    onClick={() => {
                      navigate("/sf");
                      setNodeMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    San Francisco
                  </button>
                </div>
              )}
            </div>

            {suggestFormUrl && (
              <a
                href={suggestFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Suggest an update
              </a>
            )}
          </div>

          {/* Mobile nav — hamburger only below 768px */}
          <div className="header-mobile-nav flex md:hidden flex-shrink-0 items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -mr-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-haspopup="dialog"
            >
              <Menu className="size-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu — same pattern as desktop dropdown: inline, fixed overlay/panel so it draws above map */}
      {mobileMenuOpen && (
        <>
          <div
            role="presentation"
            aria-hidden
            onClick={closeMobileMenu}
            className="fixed inset-0 bg-black/40 md:hidden"
            style={{ zIndex: Z_INDEX_MODAL_BACKDROP }}
          />
          <div
            ref={mobileMenuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-y-0 right-0 w-full max-w-[min(20rem,100%)] flex flex-col bg-white shadow-2xl md:hidden rounded-l-2xl overflow-hidden"
            style={{
              zIndex: Z_INDEX_MODAL_CONTENT,
              animation: "slideInRight 0.25s ease-out",
            }}
          >
            <div className="flex items-center justify-between flex-shrink-0 px-4 py-4 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-900">Menu</span>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="p-2 -m-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-auto py-2" aria-label="Main navigation">
              <ul className="space-y-0.5 px-3">
                <li>
                  <button
                    onClick={() => {
                      navigate("/");
                      onTabChange("map");
                      closeMobileMenu();
                    }}
                    className={`w-full text-left px-4 py-3.5 rounded-xl text-base font-medium border transition-colors ${
                      isMapRoute
                        ? "bg-violet-100 text-violet-900 border-violet-200"
                        : "text-gray-700 bg-gray-50 border border-gray-200 hover:bg-gray-100 active:bg-gray-200"
                    }`}
                  >
                    Foresight map
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      navigate("/berlin");
                      closeMobileMenu();
                    }}
                    className={`w-full text-left px-4 py-3.5 rounded-xl text-base font-medium border transition-colors ${
                      route === "/berlin"
                        ? "bg-violet-100 text-violet-900 border-violet-200"
                        : "text-gray-700 bg-gray-50 border border-gray-200 hover:bg-gray-100 active:bg-gray-200"
                    }`}
                  >
                    Berlin programming
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      navigate("/sf");
                      closeMobileMenu();
                    }}
                    className={`w-full text-left px-4 py-3.5 rounded-xl text-base font-medium border transition-colors ${
                      route === "/sf"
                        ? "bg-violet-100 text-violet-900 border-violet-200"
                        : "text-gray-700 bg-gray-50 border border-gray-200 hover:bg-gray-100 active:bg-gray-200"
                    }`}
                  >
                    SF programming
                  </button>
                </li>
                {suggestFormUrl && (
                  <li className="pt-2 mt-2 border-t border-gray-100">
                    <a
                      href={suggestFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={closeMobileMenu}
                      className="block w-full text-left px-4 py-3.5 rounded-xl text-base font-medium text-gray-700 bg-gray-50 border border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                    >
                      Suggest an update
                    </a>
                  </li>
                )}
              </ul>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
