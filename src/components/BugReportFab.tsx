/**
 * BugReportFab — a small corner control that asks before it opens mail.
 * The first tap only confirms they found a bug. "Tell us" then opens a draft
 * in the Gmail or Outlook app on a phone, or in the browser on a computer.
 */

import { useState, type ReactNode } from "react";
import { Bug, ExternalLink, Mail } from "lucide-react";
import { Z_INDEX_BUG_REPORT } from "../constants/zIndex";
import { isPhoneBrowser, openBugReportCompose } from "../utils/checkInAuth";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function BugReportFab() {
  const [open, setOpen] = useState(false);
  const [readyToSend, setReadyToSend] = useState(false);

  return (
    <div
      className="fixed right-3 bottom-[max(2.5rem,calc(env(safe-area-inset-bottom,0px)+1.75rem))] md:bottom-[4.25rem]"
      style={{ zIndex: Z_INDEX_BUG_REPORT }}
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setReadyToSend(false);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Report a bug"
            title="Report a bug"
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
          className="w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border-gray-200 bg-white p-3.5 text-gray-800 shadow-lg"
          style={{ zIndex: Z_INDEX_BUG_REPORT + 1 }}
        >
          <p className="text-sm leading-relaxed text-gray-700">
            The Foresight Atlas is humbly in beta. Did you find a bug?
          </p>
          {readyToSend ? (
            <div className="mt-3 grid gap-1.5">
              <p className="text-xs font-medium text-gray-500">Tell us with</p>
              <ComposeChoice
                icon={<ExternalLink className="size-3.5" />}
                label={isPhoneBrowser() ? "Gmail app" : "Gmail"}
                onClick={() => openBugReportCompose("gmail")}
              />
              <ComposeChoice
                icon={<ExternalLink className="size-3.5" />}
                label={isPhoneBrowser() ? "Outlook app" : "Outlook"}
                onClick={() => openBugReportCompose("outlook")}
              />
              <ComposeChoice
                icon={<Mail className="size-3.5" />}
                label="Mail app"
                onClick={() => openBugReportCompose("mailto")}
              />
              {isPhoneBrowser() ? (
                <p className="px-2 pt-1 text-xs leading-snug text-gray-500">
                  Gmail and Outlook open the installed app. If that app isn’t on this phone, use Mail.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-9 rounded-lg px-2.5 text-sm font-medium text-gray-500 hover:text-gray-800"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => setReadyToSend(true)}
                className="min-h-9 rounded-lg bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800"
              >
                Tell us
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
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
