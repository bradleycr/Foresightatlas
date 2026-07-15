/**
 * Compact self-serve password reset: email the magic link on file.
 */

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { requestPasswordResetEmail } from "../../services/memberAuth";
import { ATLAS_PASSWORD_RESET_MAILTO } from "../../utils/checkInAuth";

interface PasswordResetRequestProps {
  onCancel?: () => void;
}

export function PasswordResetRequest({ onCancel }: PasswordResetRequestProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setDoneMessage(null);
    setIsSubmitting(true);
    try {
      const result = await requestPasswordResetEmail(email.trim());
      setDoneMessage(
        result.message ||
          "If that email is on file, you'll get a magic link shortly.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (doneMessage) {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4">
        <p className="text-sm leading-6 text-emerald-900">{doneMessage}</p>
        {onCancel ? (
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={onCancel}>
            Back to sign in
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-gray-900">Reset with email</h3>
        <p className="text-sm leading-6 text-gray-600">
          Enter the email on your Atlas profile. We&apos;ll send a one-time magic link —
          no need to message an admin.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password-reset-email">Email on file</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            id="password-reset-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="h-11 pl-10"
          />
        </div>
      </div>
      {error ? (
        <div className="space-y-2">
          <p className="text-sm text-red-700">{error}</p>
          <p className="text-xs text-gray-500">
            Still stuck?{" "}
            <a href={ATLAS_PASSWORD_RESET_MAILTO} className="font-medium text-sky-600 hover:text-sky-800">
              Email an admin
            </a>
            .
          </p>
        </div>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="ghost" className="min-h-[44px]" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting} className="min-h-[44px]">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Send magic link
        </Button>
      </div>
    </form>
  );
}
