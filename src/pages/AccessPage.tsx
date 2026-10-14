/**
 * Self-serve access — enter name + email, get a claim or reset magic link.
 *
 * Public (no session). Anti-enumeration: the success copy is the same whether
 * or not we found a roster match. Locally, with Resend unset, the API may
 * return claim_link for testing.
 */

import { useState, type FormEvent } from "react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import foresightIconUrl from "../assets/Foresight_RGB_Icon_Black.png?url";
import { FORESIGHT_ORG_URL } from "../constants/foresight";
import { requestAccessMagicLink } from "../services/accessRequest";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const PAGE_BG =
  "linear-gradient(180deg, #f7f6f3 0%, #ffffff 42%, #f3f1ec 100%)";

interface AccessPageProps {
  onNavigateHome: () => void;
}

export function AccessPage({ onNavigateHome }: AccessPageProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [claimLink, setClaimLink] = useState<string | null>(null);
  const [kind, setKind] = useState<"claim" | "reset" | null>(null);
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("working");
    setError(null);
    setClaimLink(null);
    try {
      const result = await requestAccessMagicLink({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
      setMessage(result.message);
      setClaimLink(result.claim_link || null);
      setKind(result.kind || null);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request a link.");
      setStatus("error");
    }
  };

  return (
    <div
      className="flex min-h-[100svh] flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 sm:min-h-[100dvh] sm:items-center sm:px-5 sm:py-10"
      style={{ background: PAGE_BG }}
    >
      <div className="mx-auto w-full max-w-md">
        <button
          type="button"
          onClick={onNavigateHome}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-neutral-600 hover:text-[var(--primary)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </button>

        <div className="mt-6 mb-6 flex items-center gap-3">
          <a
            href={FORESIGHT_ORG_URL}
            target="_blank"
            rel="noreferrer"
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white shadow-sm"
          >
            <img src={foresightIconUrl} alt="Foresight Institute" className="size-6" />
          </a>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              The Foresight Atlas
            </p>
            <h1 className="font-heading text-xl font-bold text-[var(--primary)]">
              Get a magic link
            </h1>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-neutral-200/90 bg-white p-5 shadow-[0_1px_0_rgba(3,2,19,0.04)] sm:p-7">
          {status === "done" ? (
            <div className="space-y-4">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--primary)_8%,white)]">
                <Mail className="size-5 text-[var(--primary)]" aria-hidden />
              </div>
              <h2 className="font-heading text-lg font-bold text-[var(--primary)]">
                Check your email
              </h2>
              <p className="text-sm leading-relaxed text-neutral-600">{message}</p>
              {claimLink ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <p className="font-medium">
                    Dev / fallback link
                    {kind ? ` (${kind})` : ""} — Resend not sending yet:
                  </p>
                  <a
                    href={claimLink}
                    className="mt-2 block break-all font-medium text-[var(--primary)] underline underline-offset-2"
                  >
                    {claimLink}
                  </a>
                </div>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full"
                onClick={() => {
                  setStatus("idle");
                  setClaimLink(null);
                }}
              >
                Request another
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <p className="text-sm leading-relaxed text-neutral-600">
                If you’re already on the atlas roster, enter the name and email
                we have on file. We’ll send a one-time link to claim your
                profile or reset your password.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="access-first">First name</Label>
                  <Input
                    id="access-first"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    required
                    className="mt-1.5 min-h-[44px]"
                  />
                </div>
                <div>
                  <Label htmlFor="access-last">Last name</Label>
                  <Input
                    id="access-last"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    required
                    className="mt-1.5 min-h-[44px]"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="access-email">Email on file</Label>
                <Input
                  id="access-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="mt-1.5 min-h-[44px]"
                />
              </div>
              {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={status === "working"}
                className="min-h-[44px] w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
              >
                {status === "working" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Mail className="size-4" />
                )}
                Email me a link
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
