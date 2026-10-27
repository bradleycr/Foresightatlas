import { useState } from "react";
import { HelpCircle, Loader2, Lock, Mail, UserCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { ATLAS_ACCESS_MAILTO, atlasPasswordResetMailto } from "../../utils/checkInAuth";

interface DirectoryLoginFormProps {
  title?: string;
  description?: string;
  submitLabel?: string;
  onSubmit: (
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  onCancel?: () => void;
  /**
   * Name this device last signed in with. Used only if they switch to the
   * name field. The email box stays empty so a password manager can fill it.
   */
  initialName?: string | null;
  /** Show a visible forgot-password line. */
  showAccountRecovery?: boolean;
}

export function DirectoryLoginForm({
  title,
  description,
  submitLabel = "Enter",
  onSubmit,
  onCancel,
  initialName,
  showAccountRecovery = false,
}: DirectoryLoginFormProps) {
  const rememberedName = (initialName ?? "").trim();
  const rememberedIsEmail = rememberedName.includes("@");
  const [mode, setMode] = useState<"email" | "name">("email");
  const [email, setEmail] = useState(rememberedIsEmail ? rememberedName : "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const identifier = (mode === "email" ? email : name).trim();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!identifier || !password) {
      setError(
        mode === "email"
          ? "Enter the email we have on file, and your password."
          : "Enter your first and last name, and your password.",
      );
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await onSubmit(identifier, password);
      if (!result.ok) {
        setError(result.error ?? "Sign-in failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} autoComplete="on" className="space-y-5">
      {title || description ? (
        <div className="space-y-2">
          {title ? (
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="text-sm leading-6 text-gray-600">{description}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          {mode === "email" ? (
            <>
              <Label htmlFor="directory-login-email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="directory-login-email"
                  name="username"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email on file"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-11 pl-10"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode("name");
                  setError(null);
                  if (!name && rememberedName && !rememberedIsEmail) {
                    setName(rememberedName);
                  }
                }}
                className="text-sm font-medium text-teal-700 transition-colors hover:text-teal-900"
              >
                Use your first and last name instead
              </button>
            </>
          ) : (
            <>
              <Label htmlFor="directory-login-name">First and last name</Label>
              <div className="relative">
                <UserCircle2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="directory-login-name"
                  name="username"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="First and last name"
                  autoComplete="username"
                  autoCapitalize="words"
                  spellCheck={false}
                  className="h-11 pl-10"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode("email");
                  setError(null);
                }}
                className="text-sm font-medium text-teal-700 transition-colors hover:text-teal-900"
              >
                Use your email instead
              </button>
            </>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="directory-login-password">Password</Label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 rounded-full"
                  aria-label="First-time login hint"
                >
                  <HelpCircle className="size-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="max-w-[280px]">
                First time here? Open the personal sign-in link you were sent.
                After that, use that password here.
              </PopoverContent>
            </Popover>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              id="directory-login-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="h-11 pl-10"
            />
          </div>
          {showAccountRecovery ? (
            <p className="text-sm text-gray-600">
              <a
                href={atlasPasswordResetMailto(identifier)}
                className="font-medium text-teal-700 transition-colors hover:text-teal-900"
              >
                Forgot your password?
              </a>{" "}
              Email our team and we'll send a new sign-in link.
            </p>
          ) : null}
        </div>
      </div>

      {/*
        New accounts are invite-only — there is intentionally no public
        "Add yourself" button. People who aren't in the directory email the
        team, who can send a private join link.
      */}
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-amber-50/40 via-gray-50/80 to-sky-50/40 px-4 py-3">
        <p className="text-sm text-gray-600">
          Not on the directory yet?{" "}
          <a
            href={ATLAS_ACCESS_MAILTO}
            className="font-medium text-teal-700 transition-colors hover:text-teal-900"
          >
            Email our team for access
          </a>
        </p>
      </div>

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
