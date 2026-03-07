import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Menu, X, LogOut, User, UserCircle2 } from "lucide-react";
import foresightLogo from "../assets/Foresight_RGB_Logo_Black.png?url";
import { Z_INDEX_SIDEBAR, Z_INDEX_HEADER_NAV, Z_INDEX_MODAL_BACKDROP, Z_INDEX_MODAL_CONTENT } from "../constants/zIndex";
import type { Identity } from "../services/identity";
import type { Person } from "../types";
import { Button } from "./ui/button";
import { DirectoryLoginForm } from "./auth/DirectoryLoginForm";

interface AppHeaderProps {
  /** Current route path: "/", "/berlin", "/sf" */
  route: string;
  /** Navigate to a path (updates history and scroll) */
  navigate: (path: string) => void;
  activeTab: "map" | "timeline";
  onTabChange: (tab: "map" | "timeline") => void;
  suggestFormUrl?: string;
  people: Person[];
  identity: Identity | null;
  onOpenProfile: () => void;
  onSignIn: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  onSignOut: () => void;
}

export function AppHeader({
  route,
  navigate,
  activeTab,
  onTabChange,
  suggestFormUrl,
  people,
  identity,
  onOpenProfile,
  onSignIn,
  onSignOut,
}: AppHeaderProps) {
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const closeNodeMenu = () => setNodeMenuOpen(false);

  const isMapRoute = route === "/";
  const isProgrammingRoute = route === "/berlin" || route === "/sf";
  const isProfileRoute = route === "/profile";
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

  useEffect(() => {
    if (accountDialogOpen) document.body.style.overflow = "hidden";
    else if (!mobileMenuOpen) document.body.style.overflow = "";
    return () => {
      if (!mobileMenuOpen) document.body.style.overflow = "";
    };
  }, [accountDialogOpen, mobileMenuOpen]);

  const identityInitials = identity
    ? identity.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : null;

  const handleAccountButtonClick = () => {
    setAccountDialogOpen(true);
    setMobileMenuOpen(false);
  };

  const closeAccountDialog = () => setAccountDialogOpen(false);

  return (
    <header
      className="border-b border-gray-200 relative bg-app-header"
      style={{
        zIndex: Z_INDEX_HEADER_NAV,
        paddingTop: "max(1rem, env(safe-area-inset-top, 0px) + 1rem)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <div className="px-4 md:px-8 pb-4 md:pb-5">
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

            <button
              type="button"
              onClick={handleAccountButtonClick}
              className={identity
                ? "size-11 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold hover:ring-2 hover:ring-sky-200 hover:ring-offset-1 transition-all flex-shrink-0 touch-manipulation"
                : "inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              }
              title={identity?.fullName ?? "Sign in to your profile"}
              aria-label={identity ? "Open account menu" : "Sign in to your profile"}
              aria-haspopup="dialog"
              aria-expanded={accountDialogOpen}
            >
              {identity ? (
                identityInitials
              ) : (
                <>
                  <UserCircle2 className="size-4" />
                  Profile
                </>
              )}
            </button>
          </div>

          {/* Mobile nav — hamburger only below 768px; min 44px touch target for accessibility */}
          <div className="header-mobile-nav flex md:hidden flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={handleAccountButtonClick}
              className={identity
                ? "size-11 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold hover:ring-2 hover:ring-sky-200 hover:ring-offset-1 transition-all touch-manipulation"
                : "min-w-[44px] min-h-[44px] rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 flex items-center justify-center"
              }
              aria-label={identity ? "Open account menu" : "Sign in to your profile"}
              aria-haspopup="dialog"
              aria-expanded={accountDialogOpen}
            >
              {identity ? identityInitials : <UserCircle2 className="size-5" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -mr-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-haspopup="dialog"
            >
              <Menu className="size-6" />
            </button>
          </div>
        </div>
      </div>

      {accountDialogOpen && createPortal(
        <>
          <div
            onClick={closeAccountDialog}
            aria-hidden
            style={{
              position: "fixed",
              inset: 0,
              zIndex: Z_INDEX_MODAL_BACKDROP,
              background: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={identity ? "Account menu" : "Profile sign in"}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: Z_INDEX_MODAL_CONTENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                pointerEvents: "auto",
                width: "100%",
                maxWidth: "24rem",
                borderRadius: "1.75rem",
                border: "1px solid #d1d5db",
                background: "#ffffff",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)",
                overflow: "hidden",
              }}
            >
              {identity ? (
                <div className="p-6 sm:p-7">
                  <div className="flex flex-col items-center text-center">
                    <div
                      className="flex items-center justify-center text-base font-semibold"
                      style={{ width: "3.5rem", height: "3.5rem", borderRadius: "1rem", background: "#ede9fe", color: "#6d28d9" }}
                    >
                      {identityInitials}
                    </div>
                    <h2 className="mt-4 text-xl font-semibold tracking-tight text-gray-900">
                      {identity.fullName}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {isProfileRoute
                        ? "Your directory profile is open."
                        : "Manage your profile or sign out from this device."}
                    </p>
                  </div>

                  <div className="mt-6 space-y-3">
                    <Button
                      type="button"
                      onClick={() => {
                        closeAccountDialog();
                        onOpenProfile();
                      }}
                      className="min-h-[44px] w-full"
                    >
                      <User className="size-4" />
                      View profile
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        closeAccountDialog();
                        onSignOut();
                      }}
                      className="min-h-[44px] w-full"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={closeAccountDialog}
                      className="min-h-[44px] w-full"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-6 sm:p-7">
                  <DirectoryLoginForm
                    people={people}
                    title="Sign in to your profile"
                    description="Use your full name and password. If this is your first sign-in, use the temporary password password123 and then choose a new one."
                    submitLabel="Sign in"
                    onCancel={closeAccountDialog}
                    onAddYourself={() => {
                      closeAccountDialog();
                      navigate("/profile?new=1");
                    }}
                    onSubmit={async (username, password) => {
                      const result = await onSignIn(username, password);
                      if (result.ok) {
                        closeAccountDialog();
                        onOpenProfile();
                      }
                      return result;
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </>,
        document.body,
      )}

      {/* Mobile menu — portal to body so backdrops aren't trapped in header stacking context */}
      {mobileMenuOpen && createPortal(
        <>
          <div
            role="presentation"
            aria-hidden
            onClick={closeMobileMenu}
            className="md:hidden"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: Z_INDEX_MODAL_BACKDROP,
              background: "rgba(0, 0, 0, 0.4)",
            }}
          />
          <div
            ref={mobileMenuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="flex flex-col bg-white shadow-2xl md:hidden overflow-hidden"
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              right: 0,
              width: "100%",
              maxWidth: "min(20rem, 100%)",
              borderTopLeftRadius: "1rem",
              borderBottomLeftRadius: "1rem",
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
                        ? "bg-sky-100 text-sky-900 border-sky-200"
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
                        ? "bg-sky-100 text-sky-900 border-sky-200"
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
                        ? "bg-sky-100 text-sky-900 border-sky-200"
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

              {/* Mobile identity strip */}
              {identity && (
                <div className="mx-3 mt-4 mb-2 p-4 rounded-xl bg-sky-50 border border-sky-100">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {identityInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {identity.fullName}
                      </p>
                      <p className="text-xs text-sky-600">
                        {isProfileRoute ? "Editing your directory profile" : "Signed in"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenProfile();
                        closeMobileMenu();
                      }}
                      className="min-h-[44px] rounded-xl border border-sky-200 bg-white px-3 text-sm font-medium text-sky-700 hover:bg-sky-100 active:bg-sky-200 transition-colors"
                    >
                      My profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSignOut();
                        closeMobileMenu();
                      }}
                      className="min-h-[44px] rounded-xl border border-sky-200 bg-white px-3 text-sm font-medium text-sky-700 hover:bg-sky-100 active:bg-sky-200 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </nav>
          </div>
        </>,
        document.body,
      )}
    </header>
  );
}
