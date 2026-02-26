/**
 * IdentityBanner — clean card for choosing your identity before RSVPing.
 *
 * Accent colours (avatar ring, search focus, open-state border) are driven by
 * the per-node NodeColorTheme so the component naturally inherits Berlin's
 * violet–rose palette or SF's amber–sky palette without any hardcoded teal.
 *
 * On desktop: dropdown below the trigger.
 * On mobile:  full-screen sheet so search and the person list are usable and
 *             the soft keyboard doesn't crush the layout.
 */

import { useState, useRef, useEffect } from "react";
import { User, LogOut, Search, ChevronDown, X } from "lucide-react";
import { Person } from "../../types";
import { Identity } from "../../services/identity";
import { NodeColorTheme } from "../../types/events";
import { cn } from "../ui/utils";
import { useIsMobile } from "../ui/use-mobile";

interface IdentityBannerProps {
  identity: Identity | null;
  people: Person[];
  onSelect: (personId: string, fullName: string) => void;
  onClear: () => void;
  theme: NodeColorTheme;
}

export function IdentityBanner({ identity, people, onSelect, onClear, theme }: IdentityBannerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const filtered = search.trim()
    ? people
        .filter((p) => p.fullName.toLowerCase().includes(search.trim().toLowerCase()))
        .slice(0, isMobile ? 50 : 8)
    : [];

  // ── Signed-in state ──────────────────────────────────────────────────────
  if (identity) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 sm:px-6 py-4 sm:py-5 flex items-center gap-3">
        <div className={cn(
          "size-8 rounded-full flex items-center justify-center flex-shrink-0",
          theme.avatarActiveBg,
        )}>
          <span className={cn("text-xs font-bold", theme.avatarActiveText)}>
            {identity.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{identity.fullName}</p>
          <p className="text-xs text-gray-400">You can RSVP to events below</p>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors px-3 py-2 rounded-lg hover:bg-gray-50"
        >
          <LogOut className="size-3" />
          Switch
        </button>
      </div>
    );
  }

  // ── Trigger button (not signed-in) ───────────────────────────────────────
  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-3 rounded-2xl border px-4 sm:px-6 py-4 min-h-[52px] sm:min-h-0 text-left transition-all touch-manipulation",
          "bg-white shadow-sm",
          open
            ? cn("ring-2", theme.triggerOpenBorder, theme.triggerOpenRing)
            : "border-gray-200 hover:border-gray-300",
        )}
      >
        <div className={cn(
          "size-9 sm:size-8 rounded-full flex items-center justify-center flex-shrink-0",
          open ? theme.avatarActiveBg : "bg-gray-100",
        )}>
          <User className={cn("size-4", open ? theme.avatarActiveText : "text-gray-400")} />
        </div>
        <span className="flex-1 text-sm text-gray-500 text-left">
          Select your name to RSVP to events
        </span>
        <ChevronDown className={cn(
          "size-4 text-gray-400 transition-transform flex-shrink-0",
          open && cn("rotate-180", theme.chevronActive),
        )} />
      </button>

      {open && (
        <>
          {isMobile ? (
            /* Full-screen sheet on mobile — keyboard-friendly and thumb-friendly */
            <div
              className="fixed inset-0 z-[100] flex flex-col bg-gray-900/60 backdrop-blur-sm"
              style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
              onClick={() => { setOpen(false); setSearch(""); }}
            >
              <div
                className="flex flex-1 flex-col min-h-0 bg-white rounded-t-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
                  <h3 className="text-base font-semibold text-gray-900">Choose your name</h3>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setSearch(""); }}
                    className="p-2 -m-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors touch-manipulation"
                    aria-label="Close"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
                  <div className={cn(
                    "flex items-center gap-2 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden",
                    "focus-within:border-transparent focus-within:ring-2",
                    theme.searchFocusRing,
                  )}>
                    <Search className="size-5 text-gray-400 flex-shrink-0 ml-3" aria-hidden />
                    <input
                      ref={inputRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Type your name…"
                      className="flex-1 min-w-0 py-3.5 pr-4 pl-1 text-base border-0 bg-transparent focus:outline-none focus:ring-0 placeholder:text-gray-400"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Start typing to find yourself in the directory. Please RSVP only for yourself.
                  </p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {!search.trim() && (
                    <p className="px-4 py-6 text-sm text-gray-400 text-center">
                      Start typing to find yourself. Please RSVP only for yourself.
                    </p>
                  )}
                  {search.trim() && filtered.length === 0 && (
                    <p className="px-4 py-6 text-sm text-gray-500 text-center">
                      No matches for &ldquo;{search.trim()}&rdquo;
                    </p>
                  )}
                  {filtered.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => { onSelect(person.id, person.fullName); setOpen(false); setSearch(""); }}
                      className="w-full text-left px-4 py-4 flex items-center gap-4 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 touch-manipulation min-h-[56px]"
                    >
                      <div className={cn(
                        "size-10 rounded-full flex items-center justify-center flex-shrink-0",
                        theme.avatarActiveBg,
                      )}>
                        <span className={cn("text-sm font-bold", theme.avatarActiveText)}>
                          {person.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{person.fullName}</p>
                        {person.currentCity && (
                          <p className="text-sm text-gray-500 truncate">{person.currentCity}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Desktop: dropdown below trigger */
            <div
              ref={containerRef}
              className="absolute top-full left-0 right-0 z-50 mt-3 rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden"
              style={{ minHeight: "120px" }}
            >
              <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                <div className={cn(
                  "flex items-center gap-2 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden",
                  "focus-within:border-transparent focus-within:ring-2",
                  theme.searchFocusRing,
                )}>
                  <Search className="size-4 text-gray-400 flex-shrink-0 ml-3" aria-hidden />
                  <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Type your name…"
                    className="flex-1 min-w-0 py-3 pr-4 pl-1 text-sm border-0 bg-transparent focus:outline-none focus:ring-0 placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto bg-white">
                {!search.trim() && (
                  <p className="px-4 py-4 text-sm text-gray-400 text-center font-normal">
                    Start typing to find yourself. Please RSVP only for yourself.
                  </p>
                )}
                {search.trim() && filtered.length === 0 && (
                  <p className="px-4 py-4 text-sm text-gray-500 text-center">
                    No matches for &ldquo;{search.trim()}&rdquo;
                  </p>
                )}
                {filtered.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => { onSelect(person.id, person.fullName); setOpen(false); setSearch(""); }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors flex items-center gap-3 border-t border-gray-50 first:border-t-0"
                  >
                    <div className={cn(
                      "size-7 rounded-full flex items-center justify-center flex-shrink-0",
                      theme.avatarActiveBg,
                    )}>
                      <span className={cn("text-[10px] font-bold", theme.avatarActiveText)}>
                        {person.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{person.fullName}</p>
                      {person.currentCity && (
                        <p className="text-xs text-gray-400 truncate">{person.currentCity}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
