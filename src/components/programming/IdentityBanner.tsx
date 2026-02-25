/**
 * IdentityBanner — clean card matching the app's white-card design language.
 * Dropdown is centered and properly positioned.
 */

import { useState, useRef, useEffect } from "react";
import { User, LogOut, Search, ChevronDown } from "lucide-react";
import { Person } from "../../types";
import { Identity } from "../../services/identity";
import { cn } from "../ui/utils";

interface IdentityBannerProps {
  identity: Identity | null;
  people: Person[];
  onSelect: (personId: string, fullName: string) => void;
  onClear: () => void;
}

export function IdentityBanner({ identity, people, onSelect, onClear }: IdentityBannerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        .slice(0, 8)
    : [];

  if (identity) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 sm:px-5 py-3 flex items-center gap-3">
        <div className="size-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-teal-700">
            {identity.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{identity.fullName}</p>
          <p className="text-xs text-gray-400">You can RSVP to events below</p>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-gray-50"
        >
          <LogOut className="size-3" />
          Switch
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-3 rounded-xl border px-4 sm:px-5 py-3.5 text-left transition-all",
          "bg-white shadow-sm",
          open
            ? "border-teal-300 ring-2 ring-teal-100"
            : "border-gray-200 hover:border-gray-300",
        )}
      >
        <div className={cn(
          "size-8 rounded-full flex items-center justify-center flex-shrink-0",
          open ? "bg-teal-100" : "bg-gray-100",
        )}>
          <User className={cn("size-4", open ? "text-teal-600" : "text-gray-400")} />
        </div>
        <span className="flex-1 text-sm text-gray-500">
          Select your name to RSVP to events
        </span>
        <ChevronDown className={cn(
          "size-4 text-gray-400 transition-transform",
          open && "rotate-180 text-teal-500",
        )} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type your name…"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto border-t border-gray-100">
            {!search.trim() && (
              <p className="px-4 py-5 text-sm text-gray-400 text-center">Start typing to find yourself</p>
            )}
            {search.trim() && filtered.length === 0 && (
              <p className="px-4 py-5 text-sm text-gray-500 text-center">No matches for &ldquo;{search.trim()}&rdquo;</p>
            )}
            {filtered.map((person) => (
              <button
                key={person.id}
                onClick={() => { onSelect(person.id, person.fullName); setOpen(false); setSearch(""); }}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-50 last:border-0"
              >
                <div className="size-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-gray-500">
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
    </div>
  );
}
