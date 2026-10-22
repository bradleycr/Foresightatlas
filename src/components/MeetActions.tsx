/**
 * Compact book / invite actions for Open to meet + Connections cards.
 * Stops click propagation so parent list rows can open the profile modal.
 */

import { Calendar, CalendarDays, ExternalLink } from "lucide-react";
import type { Person } from "../types";
import { getOpenToMeetUrl, isOpenToMeet } from "../utils/openToMeet";
import { buildGoogleCalendarTemplateUrl } from "../utils/googleCalendarTemplate";
import { isContactSuppressed } from "../utils/contactPrivacy";
import { cn } from "./ui/utils";

function isRecognizedEmail(value: string | null | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

interface MeetActionsProps {
  person: Person;
  className?: string;
  /** Compact = icon+short labels for dense connection rows. */
  compact?: boolean;
}

export function MeetActions({ person, className, compact = false }: MeetActionsProps) {
  if (isContactSuppressed(person)) return null;

  const bookUrl = getOpenToMeetUrl(person);
  const open = isOpenToMeet(person);
  const inviteEmail = isRecognizedEmail(person.calendarEmail)
    ? String(person.calendarEmail).trim()
    : null;

  if (!open && !inviteEmail) return null;

  const inviteUrl = inviteEmail
    ? buildGoogleCalendarTemplateUrl({
        title: `Meet: ${person.fullName}`,
        details: `Inviting ${person.fullName} from The Foresight Atlas.`,
        addGuests: [inviteEmail],
      })
    : null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {open && bookUrl ? (
        <a
          href={bookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-100 touch-manipulation",
            compact && "px-2.5 text-xs sm:text-sm",
          )}
        >
          <Calendar className="size-3.5 shrink-0" aria-hidden />
          {compact ? "Book" : "Book time"}
          <ExternalLink className="size-3 opacity-70" aria-hidden />
        </a>
      ) : null}
      {inviteUrl ? (
        <a
          href={inviteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-medium text-sky-900 transition-colors hover:bg-sky-100 touch-manipulation",
            compact && "px-2.5 text-xs sm:text-sm",
          )}
        >
          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          {compact ? "Invite" : "Invite to Meet"}
          <ExternalLink className="size-3 opacity-70" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

export function OpenToMeetBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800",
        className,
      )}
    >
      Open to meet
    </span>
  );
}
