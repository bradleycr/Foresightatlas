/**
 * BugReportFab — a small corner control for two kinds of notes.
 *
 * The first tap only asks what they want to send. Choosing "Report a bug"
 * or "Request a feature" then opens a draft in Gmail, Outlook, or the
 * device mail app, with the subject and prompts already matched to that choice.
 */

import { useState, type ReactNode } from "react";
import { Bug, ChevronLeft, ExternalLink, Lightbulb, Mail } from "lucide-react";
import { Z_INDEX_BUG_REPORT } from "../constants/zIndex";
import {
  isPhoneBrowser,
  openBugReportCompose,
  type AtlasNoteIntent,
} from "../utils/checkInAuth";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function BugReportFab() {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<AtlasNoteIntent | null>(null);

  const close = () => {
    setOpen(false);
    setIntent(null);
  };

  return (
    <div
      className="fixed right-3 bottom-[max(2.5rem,calc(env(safe-area-inset-bottom,0px)+1.75rem))] md:bottom-[4.25rem]"
      style={{ zIndex: Z_INDEX_BUG_REPORT }}
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setIntent(null);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Report a bug or request a feature"
            title="Report a bug or request a feature"
            className="inline-grid size-8 place-items-center rounded-md border border-gray-300 bg-white p-0 text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-1 touch-manipulation"
          >
            {/*
              The bug glyph sits a hair left in its box, so the right side
              of the button looked emptier than the left. Nudge it back to center.
            */}
            <Bug className="size-3.5 translate-x-px" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={8}
          className="w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border-gray-200 bg-white p-3.5 text-gray-800 shadow-lg"
          style={{ zIndex: Z_INDEX_BUG_REPORT + 1 }}
        >
          {intent ? (
            <ComposeStep intent={intent} onBack={() => setIntent(null)} />
          ) : (
            <ChooseStep onChoose={setIntent} onDismiss={close} />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ChooseStep({
  onChoose,
  onDismiss,
}: {
  onChoose: (intent: AtlasNoteIntent) => void;
  onDismiss: () => void;
}) {
  return (
    <>
      <p className="text-sm leading-relaxed text-gray-700">
        The Foresight Atlas is humbly in beta.
      </p>
      <div className="mt-3 grid gap-1">
        <IntentChoice
          icon={<Bug className="size-3.5" />}
          label="Report a bug"
          hint="Something broke"
          onClick={() => onChoose("bug")}
        />
        <IntentChoice
          icon={<Lightbulb className="size-3.5" />}
          label="Request a feature"
          hint="Something you'd like to see"
          onClick={() => onChoose("feature")}
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-9 rounded-lg px-2.5 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          Not now
        </button>
      </div>
    </>
  );
}

function ComposeStep({
  intent,
  onBack,
}: {
  intent: AtlasNoteIntent;
  onBack: () => void;
}) {
  const feature = intent === "feature";
  return (
    <div className="grid gap-1.5">
      <button
        type="button"
        onClick={onBack}
        className="mb-1 inline-flex min-h-8 w-fit items-center gap-1 rounded-lg pr-2 text-xs font-medium text-gray-500 hover:text-gray-800"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        Back
      </button>
      <p className="text-sm leading-relaxed text-gray-700">
        {feature ? "Tell us what you'd like to see." : "Tell us what went wrong."}
      </p>
      <p className="pt-1 text-xs font-medium text-gray-500">Send with</p>
      <ComposeChoice
        icon={<ExternalLink className="size-3.5" />}
        label={isPhoneBrowser() ? "Gmail app" : "Gmail"}
        onClick={() => openBugReportCompose("gmail", { intent })}
      />
      <ComposeChoice
        icon={<ExternalLink className="size-3.5" />}
        label={isPhoneBrowser() ? "Outlook app" : "Outlook"}
        onClick={() => openBugReportCompose("outlook", { intent })}
      />
      <ComposeChoice
        icon={<Mail className="size-3.5" />}
        label="Mail app"
        onClick={() => openBugReportCompose("mailto", { intent })}
      />
      {isPhoneBrowser() ? (
        <p className="px-2 pt-1 text-xs leading-snug text-gray-500">
          Gmail and Outlook open the installed app. If that app isn’t on this phone, use Mail.
        </p>
      ) : null}
    </div>
  );
}

function IntentChoice({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center gap-2.5 rounded-xl px-2 text-left hover:bg-gray-50"
    >
      <span
        className="inline-grid size-8 shrink-0 place-items-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600"
        aria-hidden
      >
        {icon}
      </span>
      <span>
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
    </button>
  );
}

function ComposeChoice({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-gray-800 hover:bg-gray-50"
    >
      <span className="text-gray-500" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
}
