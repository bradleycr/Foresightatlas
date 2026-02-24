/**
 * Identity selector — matches the app's FellowCard visual language.
 * A clean white card strip. Once a name is picked it shrinks to a
 * quiet signed-in strip. No real auth — localStorage identity.
 */

import { useState, useRef, useEffect } from "react";
import { User, LogOut, ChevronDown } from "lucide-react";
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
    if (open) inputRef.current?.focus();
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
    ? people.filter((p) => p.fullName.toLowerCase().includes(search.trim().toLowerCase()))
    : [];

  /* ── signed-in strip ───────────────────────────────────────────── */
  if (identity) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-white border border-gray-100 px-5 py-3.5 shadow-sm">
        <div className="size-7 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
          <User className="size-3.5 text-teal-600" />
        </div>
        <span className="text-sm text-gray-700 flex-1">
          Signed in as <strong className="font-semibold text-gray-900">{identity.fullName}</strong>
        </span>
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <LogOut className="size-3.5" />
          Switch
        </button>
      </div>
    );
  }

  /* ── picker ─────────────────────────────────────────────────────── */
  return (
    <div ref={containerRef} className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-visible">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="size-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <User className="size-3.5 text-gray-500" />
          </div>
          <span className="text-sm font-medium text-gray-800">
            Select your name to RSVP to events
          </span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-all",
            open
              ? "bg-gray-900 text-white"
              : "text-teal-600 hover:bg-teal-50 hover:text-teal-700",
          )}
        >
          Choose
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="border-t border-gray-100">
          <div className="p-4 space-y-3">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type your name to find yourself…"
              className="w-full px-4 py-3 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            {!search.trim() && (
              <p className="text-xs text-gray-400 px-0.5 leading-relaxed">
                Search by name — no need to scroll through the list
              </p>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto border-t border-gray-50 pt-1">
            {search.trim() && filtered.length === 0 && (
              <p className="px-4 py-4 text-sm text-gray-500">No matches for “{search.trim()}”</p>
            )}
            {filtered.length > 0 && filtered.map((person) => (
              <button
                key={person.id}
                onClick={() => {
                  onSelect(person.id, person.fullName);
                  setOpen(false);
                  setSearch("");
                }}
                className="w-full text-left px-4 py-3 text-sm hover:bg-teal-50 transition-colors flex items-center justify-between gap-3 group"
              >
                <span className="font-medium text-gray-800 group-hover:text-teal-700 transition-colors">
                  {person.fullName}
                </span>
                <span className="text-xs text-gray-400 truncate flex-shrink-0">
                  {person.currentCity}
                </span>
              </button>
            ))}
            {search.trim() && filtered.length > 0 && (
              <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">
                {filtered.length} match{filtered.length !== 1 ? "es" : ""}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
