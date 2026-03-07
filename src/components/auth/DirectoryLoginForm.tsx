import { useMemo, useState } from "react";
import { ChevronLeft, HelpCircle, Loader2, Lock, Search, UserCircle2, UserPlus } from "lucide-react";
import type { Person } from "../../types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";

/** Default temporary password for first-time directory sign-in (must match backend DEFAULT_DIRECTORY_PASSWORD). */
const DEFAULT_TEMP_PASSWORD = "password123";

interface DirectoryLoginFormProps {
  people: Person[];
  title: string;
  description: string;
  submitLabel?: string;
  onSubmit: (
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  onCancel?: () => void;
  /** When the user can't find their name and wants to add a new profile from scratch. */
  onAddYourself?: () => void;
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

export function DirectoryLoginForm({
  people,
  title,
  description,
  submitLabel = "Sign in",
  onSubmit,
  onCancel,
  onAddYourself,
}: DirectoryLoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suggestions = useMemo(() => {
    if (selectedMatch) return [];
    const query = normalizeQuery(username);
    if (!query) return [];
    const seen = new Set<string>();
    return people
      .filter((person) => {
        const name = person.fullName.toLowerCase();
        if (seen.has(name)) return false;
        if (!name.includes(query)) return false;
        seen.add(name);
        return true;
      })
      .slice(0, 6);
  }, [people, username, selectedMatch]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const nameToUse = selectedMatch?.fullName ?? username.trim();
    if (!nameToUse) {
      setError("Select your name from the list or enter it above.");
      setIsSubmitting(false);
      return;
    }
    try {
      const result = await onSubmit(nameToUse, password);
      if (!result.ok) {
        setError(result.error ?? "Sign-in failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChooseSomeoneElse = () => {
    setSelectedMatch(null);
    setPassword("");
    setError(null);
  };

  const hasSelection = selectedMatch !== null;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">
          {title}
        </h2>
        <p className="text-sm leading-6 text-gray-600">{description}</p>
      </div>

      <div className="space-y-4">
        {hasSelection ? (
          /* Confirmed selection: show only who they picked and the password step. */
          <div className="space-y-3">
            <div className="rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-600/90">
                You’ve selected
              </p>
              <p className="mt-1 font-medium text-gray-900">{selectedMatch!.fullName}</p>
              <button
                type="button"
                onClick={handleChooseSomeoneElse}
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-sky-600 transition-colors hover:text-sky-800"
              >
                <ChevronLeft className="size-3.5" />
                Choose someone else
              </button>
            </div>
          </div>
        ) : (
          /* Name search and match list */
          <div className="space-y-2">
            <Label htmlFor="directory-login-name">Full name</Label>
            <div className="relative">
              <UserCircle2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="directory-login-name"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="First and last name"
                autoComplete="username"
                className="h-11 pl-10"
              />
            </div>
            {suggestions.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-2">
                <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">
                  Matches — tap to select
                </p>
                <div className="space-y-1">
                  {suggestions.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => {
                        setSelectedMatch(person);
                        setError(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-white hover:text-gray-900"
                    >
                      <Search className="size-3.5 text-gray-400" />
                      <span className="truncate">{person.fullName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="directory-login-password">Password</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 rounded-full"
                  aria-label="First-time login hint"
                >
                  <HelpCircle className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" theme="light" className="max-w-[260px]">
                Haven&apos;t logged in before? Your temporary password is{" "}
                <span className="font-semibold text-teal-700">{DEFAULT_TEMP_PASSWORD}</span>
                . You&apos;ll set your own password after signing in.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              id="directory-login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="h-11 pl-10"
            />
          </div>
          {!hasSelection && (
            <p className="text-xs leading-5 text-gray-500">
              Use your full name and password. First time? Your temporary password is{" "}
              <span className="font-medium text-gray-700">{DEFAULT_TEMP_PASSWORD}</span>
              — you can set your own after signing in.
            </p>
          )}
          {hasSelection && (
            <p className="text-xs leading-5 text-gray-500">
              First time? Use <span className="font-medium text-gray-700">{DEFAULT_TEMP_PASSWORD}</span>.
              Otherwise enter your password, then sign in.
            </p>
          )}
        </div>
      </div>

      {onAddYourself && !hasSelection && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-3">
          <p className="text-sm text-gray-600">
            Can’t find your name?
          </p>
          <button
            type="button"
            onClick={onAddYourself}
            className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-sky-600 transition-colors hover:text-sky-800"
          >
            <UserPlus className="size-4" />
            Add yourself
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="min-h-[44px] px-5">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
