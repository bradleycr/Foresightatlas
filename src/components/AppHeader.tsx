import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Menu, X, LogOut, User, UserCircle2, Bookmark, CalendarDays } from "lucide-react";
import foresightLogo from "../assets/Foresight_RGB_Logo_Black.png?url";
import foresightIcon from "../assets/Foresight_RGB_Icon_Black.png?url";
import { Z_INDEX_SIDEBAR, Z_INDEX_HEADER_NAV, Z_INDEX_MODAL_BACKDROP, Z_INDEX_MODAL_CONTENT } from "../constants/zIndex";
import type { Identity } from "../services/identity";
import type { Person } from "../types";
import { Button } from "./ui/button";
import { DirectoryLoginForm } from "./auth/DirectoryLoginForm";
import { getLastSignedInName } from "../services/identity";
import { cn } from "./ui/utils";

interface AppHeaderProps {
  /** Current route path: "/", "/berlin", "/sf", "/calendar", etc. */
  route: string;
  /** Navigate to a path (updates history and scroll) */
  navigate: (path: string) => void;
  /** Clear map-only overlays (e.g. event RSVP filter) when user returns to the map via header. */
  onNavigateHome?: () => void;
  /** Mobile hamburger menu — lifted to App so the map list sheet can share the same menu. */
  mobileMenuOpen: boolean;
  onMobileMenuOpenChange: (open: boolean) => void;
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
  onNavigateHome,
  mobileMenuOpen,
  onMobileMenuOpenChange,
  suggestFormUrl,
  people,
  identity,
  onOpenProfile,
  onSignIn,
  onSignOut,
}: AppHeaderProps) {
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const closeMobileMenu = () => onMobileMenuOpenChange(false);
  const closeNodeMenu = () => setNodeMenuOpen(false);

  const isMapRoute = route === "/";
  const isProgrammingRoute = route === "/berlin" || route === "/sf" || route === "/global";
  const isProfileRoute = route === "/profile";
  /*
   * Connections is no longer a top-level destination in the header — the profile
   * dialog surfaces it instead. The route itself is still live and reachable
   * from the profile menu; it just doesn't need a nav pill of its own.
   */
  const subtext = "Internal tool — connect with grantees, fellows and nodees.";
  /*
   * Tiny beta marker — an inline sibling of the title text so it always sits
   * on the same baseline as "Foresight map & Node programming". Using a
   * gradient pill with the text made it feel like a separate component that
   * sometimes drifted; a minimal parenthetical, typographically tied to the
   * title, reads as an extension of the wordmark.
   */
  const betaMark = (
    <span
      className="align-baseline text-[0.65em] font-medium uppercase tracking-wide text-stone-400"
      aria-label="Beta — this app is still in development"
    >
      &nbsp;(beta)
    </span>
  );

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
        onMobileMenuOpenChange(false);
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
    onMobileMenuOpenChange(false);
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
      <div className="px-3 sm:px-4 md:px-8 pb-3.5 sm:pb-4 md:pb-5">
        <div className="flex min-h-0 flex-nowrap items-start justify-between gap-2 sm:gap-3 md:items-center">
          {/* Logo + title — mobile-first: readable sizes, natural wrap, no harsh truncation */}
          <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3 md:items-center md:gap-4">
            <button
              type="button"
              onClick={() => {
                navigate("/");
                onNavigateHome?.();
              }}
              className="flex shrink-0 cursor-pointer items-center rounded-md transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
              aria-label="Back to map"
            >
              <img
                src={foresightLogo}
                alt="Foresight Institute"
                /* Bumped from h-8/9/12: the wordmark is the identity anchor; previous sizing
                 * felt cramped next to the chunky nav pills. New sizes stay in proportion
                 * with the title's line-height so nothing reflows. */
                className="h-11 w-auto sm:h-12 md:h-14"
              />
            </button>
            <div className="min-w-0 flex-1 border-l border-gray-200/90 pl-2.5 sm:pl-3 md:border-gray-300 md:pl-4">
              <h1 className="font-heading font-semibold tracking-tight text-gray-900 text-balance">
                {/*
                 * Two-line title on narrow viewports, single line from `sm` up.
                 * The (beta) marker is a sibling of the title text so it reads
                 * as part of the name rather than a detached chip. It stays on
                 * the same line as the last word via non-breaking space.
                 */}
                <span className="min-w-0 text-[0.9375rem] leading-snug sm:text-base md:text-xl md:leading-tight">
                  <span className="sm:hidden">
                    Foresight map &amp;
                    <br />
                    Node programming{betaMark}
                  </span>
                  <span className="hidden sm:inline">
                    Foresight map &amp; Node programming{betaMark}
                  </span>
                </span>
              </h1>
              <p className="mt-1.5 max-w-[min(100%,38rem)] text-pretty text-[0.8125rem] leading-relaxed text-gray-600 sm:text-[0.8125rem] md:mt-2 md:text-sm md:leading-relaxed">
                {subtext}
              </p>
            </div>
          </div>

          {/* Desktop nav — original pill-style Map + Programming */}
          <div className="header-desktop-nav flex-shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                navigate("/");
                onNavigateHome?.();
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
                    Berlin node
                  </button>
                  <button
                    onClick={() => {
                      navigate("/sf");
                      setNodeMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    SF node
                  </button>
                  <button
                    onClick={() => {
                      navigate("/global");
                      setNodeMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    Global
                  </button>
                </div>
              )}
            </div>

            {/* Connections intentionally omitted from the header — surfaced in the profile dialog instead. */}

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
                ? "relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-cyan-100 to-emerald-100 text-sky-700 ring-1 ring-gray-200/80 text-xs font-bold transition-all hover:from-cyan-200 hover:to-emerald-200 hover:ring-2 hover:ring-sky-200 hover:ring-offset-1 touch-manipulation"
                : "inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              }
              title={identity?.fullName ?? "Sign in to your profile"}
              aria-label={identity ? "Open account menu" : "Sign in to your profile"}
              aria-haspopup="dialog"
              aria-expanded={accountDialogOpen}
            >
              {identity ? (
                <>
                  <img src={foresightIcon} alt="" className="pointer-events-none absolute inset-0 size-full object-contain p-0.5 opacity-50 scale-125" aria-hidden />
                  <span className="relative z-10 text-[10px] font-medium text-sky-700/90">{identityInitials}</span>
                </>
              ) : (
                <>
                  <UserCircle2 className="size-4" />
                  Profile
                </>
              )}
            </button>
          </div>

          {/* Mobile nav — hamburger + account; pill style to match desktop nav */}
          <div className="header-mobile-nav flex md:hidden flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleAccountButtonClick}
              className={identity
                ? "relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-cyan-100 to-emerald-100 ring-1 ring-gray-200/80 transition-all hover:from-cyan-200 hover:to-emerald-200 hover:ring-2 hover:ring-sky-200 hover:ring-offset-1 touch-manipulation"
                : "min-w-[44px] min-h-[44px] rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 flex items-center justify-center"
              }
              aria-label={identity ? "Open account menu" : "Sign in to your profile"}
              aria-haspopup="dialog"
              aria-expanded={accountDialogOpen}
            >
              {identity ? (
                <>
                  <img src={foresightIcon} alt="" className="pointer-events-none absolute inset-0 size-full object-contain p-0.5 opacity-50 scale-125" aria-hidden />
                  <span className="relative z-10 text-[10px] font-medium text-sky-700/90">{identityInitials}</span>
                </>
              ) : (
                <UserCircle2 className="size-5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onMobileMenuOpenChange(!mobileMenuOpen)}
              className={cn(
                "min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border transition-all touch-manipulation",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2",
                mobileMenuOpen
                  ? "bg-app-tab-active text-gray-900 shadow-sm border-white/50"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-sm",
              )}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-haspopup="dialog"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
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
                    <div className="relative flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/80 sm:size-16">
                      <img src={foresightIcon} alt="" className="absolute inset-0 size-full object-contain p-0.5 opacity-50 scale-125" aria-hidden />
                      <span className="relative z-10 text-sm font-medium text-sky-700/85">{identityInitials}</span>
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
                      className="min-h-[44px] w-full border-0 bg-gradient-to-r from-cyan-100 to-emerald-100 text-gray-900 shadow-sm hover:from-cyan-200 hover:to-emerald-200"
                    >
                      <User className="size-4" />
                      View profile
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        closeAccountDialog();
                        navigate("/connections");
                      }}
                      className="min-h-[44px] w-full"
                    >
                      <Bookmark className="size-4" />
                      Connections
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        closeAccountDialog();
                        navigate("/calendar");
                      }}
                      className="min-h-[44px] w-full"
                    >
                      <CalendarDays className="size-4" />
                      Calendar
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
                    description="Use your full name and password."
                    submitLabel="Sign in"
                    initialName={getLastSignedInName()}
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
              background: "rgba(0, 0, 0, 0.35)",
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
            }}
          />
          <div
            ref={mobileMenuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="flex flex-col md:hidden overflow-hidden bg-app-header"
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              right: 0,
              width: "100%",
              maxWidth: "min(22rem, 100%)",
              borderLeft: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)",
              zIndex: Z_INDEX_MODAL_CONTENT,
              animation: "slideInRight 0.25s ease-out",
            }}
          >
            {/* Panel header — gradient strip + logo + close, matches app header feel */}
            <div
              className="flex items-center justify-between flex-shrink-0 px-4 py-4 border-b border-gray-200/80"
              style={{ background: "linear-gradient(to bottom, #ffffff 0%, #fafafa 100%)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <img src={foresightIcon} alt="" className="h-8 w-8 flex-shrink-0 opacity-90" />
                <span className="text-sm font-semibold text-gray-900 font-heading tracking-tight">Menu</span>
              </div>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="p-2.5 -m-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-auto py-4 px-3" aria-label="Main navigation">
              <ul className="space-y-1.5">
                <li>
                  <button
                    onClick={() => {
                      navigate("/");
                      onNavigateHome?.();
                      closeMobileMenu();
                    }}
                    className={`w-full text-left px-4 py-3.5 min-h-[48px] rounded-xl text-base font-medium border transition-colors touch-manipulation flex items-center ${
                      isMapRoute
                        ? "bg-app-tab-active text-gray-900 border-white/50 shadow-sm"
                        : "text-gray-700 bg-gray-50/80 border border-gray-200 hover:bg-gray-100 active:bg-gray-200"
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
                    className={`w-full text-left px-4 py-3.5 min-h-[48px] rounded-xl text-base font-medium border transition-colors touch-manipulation flex items-center ${
                      route === "/berlin"
                        ? "bg-app-tab-active text-gray-900 border-white/50 shadow-sm"
                        : "text-gray-700 bg-gray-50/80 border border-gray-200 hover:bg-gray-100 active:bg-gray-200"
                    }`}
                  >
                    Berlin node
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      navigate("/sf");
                      closeMobileMenu();
                    }}
                    className={`w-full text-left px-4 py-3.5 min-h-[48px] rounded-xl text-base font-medium border transition-colors touch-manipulation flex items-center ${
                      route === "/sf"
                        ? "bg-app-tab-active text-gray-900 border-white/50 shadow-sm"
                        : "text-gray-700 bg-gray-50/80 border border-gray-200 hover:bg-gray-100 active:bg-gray-200"
                    }`}
                  >
                    SF node
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      navigate("/global");
                      closeMobileMenu();
                    }}
                    className={`w-full text-left px-4 py-3.5 min-h-[48px] rounded-xl text-base font-medium border transition-colors touch-manipulation flex items-center ${
                      route === "/global"
                        ? "bg-app-tab-active text-gray-900 border-white/50 shadow-sm"
                        : "text-gray-700 bg-gray-50/80 border border-gray-200 hover:bg-gray-100 active:bg-gray-200"
                    }`}
                  >
                    Global programming
                  </button>
                </li>
                {/* Connections removed from nav; users reach it from the profile dialog. */}
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
                <div className="mx-3 mt-4 mb-2 p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-emerald-50 border border-sky-100">
                  <div className="flex items-start gap-3">
                    <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-gray-200/80">
                      <img src={foresightIcon} alt="" className="pointer-events-none absolute inset-0 size-full object-contain p-0.5 opacity-50 scale-125" aria-hidden />
                      <span className="relative z-10 text-xs font-medium text-sky-700/85">{identityInitials}</span>
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
