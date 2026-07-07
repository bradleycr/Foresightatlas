/**
 * Contact links for person profiles — consistent labels, icons, and actions
 * for email, LinkedIn, X, GitHub, websites, calendar, and booking URLs.
 */

import type { ReactNode } from "react";
import {
  Calendar,
  CalendarDays,
  ChevronDown,
  Copy,
  ExternalLink,
  Github,
  Globe,
  Linkedin,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "./ui/utils";
import { Z_INDEX_MODAL_DROPDOWN } from "../constants/zIndex";
import { buildGoogleCalendarTemplateUrl } from "../utils/googleCalendarTemplate";
import {
  isRecognizedEmail,
  parseContact,
  parseWebsiteLink,
  sameContactHref,
  type ContactKind,
  type ParsedContact,
} from "../utils/contactInfo";
import type { Person } from "../types";

const KIND_STYLES: Record<
  ContactKind,
  { button: string; hover: string; icon: string }
> = {
  email: {
    button: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    hover: "hover:bg-emerald-100 hover:border-emerald-300",
    icon: "text-emerald-700",
  },
  linkedin: {
    button: "bg-sky-50 text-sky-900 border-sky-200/80",
    hover: "hover:bg-sky-100 hover:border-sky-300",
    icon: "text-sky-700",
  },
  twitter: {
    button: "bg-slate-100 text-slate-900 border-slate-200/80",
    hover: "hover:bg-slate-200/80 hover:border-slate-300",
    icon: "text-slate-700",
  },
  github: {
    button: "bg-violet-50 text-violet-900 border-violet-200/80",
    hover: "hover:bg-violet-100 hover:border-violet-300",
    icon: "text-violet-700",
  },
  website: {
    button: "bg-teal-50 text-teal-900 border-teal-200/80",
    hover: "hover:bg-teal-100 hover:border-teal-300",
    icon: "text-teal-700",
  },
};

function ContactKindIcon({
  kind,
  className,
}: {
  kind: ContactKind;
  className?: string;
}) {
  const props = { className: cn("h-4 w-4 shrink-0", className), "aria-hidden": true as const };
  switch (kind) {
    case "email":
      return <Mail {...props} />;
    case "linkedin":
      return <Linkedin {...props} />;
    case "twitter":
      return <ExternalLink {...props} />;
    case "github":
      return <Github {...props} />;
    default:
      return <Globe {...props} />;
  }
}

function copyToClipboard(value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success("Copied to clipboard"),
    () => toast.error("Could not copy"),
  );
}

function ContactActionButton({ contact }: { contact: ParsedContact }) {
  const styles = KIND_STYLES[contact.kind];
  const handleOpen = () => {
    if (contact.kind === "email") {
      window.location.href = contact.href;
      return;
    }
    window.open(contact.href, "_blank", "noopener,noreferrer");
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium shadow-sm transition-colors sm:min-h-[40px]",
            styles.button,
            styles.hover,
          )}
          aria-haspopup="menu"
          aria-label={`${contact.label}. Open menu for contact options.`}
        >
          <ContactKindIcon kind={contact.kind} className={styles.icon} />
          <span className="min-w-0 truncate">{contact.label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[12rem] !bg-white text-gray-900 border border-gray-200 shadow-xl rounded-lg py-1"
        style={{ zIndex: Z_INDEX_MODAL_DROPDOWN }}
      >
        <DropdownMenuItem onSelect={handleOpen}>
          <ContactKindIcon kind={contact.kind} />
          {contact.openLabel}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copyToClipboard(contact.raw)}>
          <Copy className="h-4 w-4" />
          {contact.copyLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SimpleContactLink({
  href,
  label,
  icon,
  ariaLabel,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="person-detail-link-secondary min-h-[44px] sm:min-h-[40px]"
      aria-label={ariaLabel ?? label}
    >
      {icon}
      {label}
    </a>
  );
}

interface PersonContactLinksProps {
  person: Person;
  /** When viewing your own profile without contact info yet. */
  isSelf?: boolean;
}

export function PersonContactLinks({ person, isSelf = false }: PersonContactLinksProps) {
  const preferred = parseContact(person.contactUrlOrHandle);
  const profileLink = parseWebsiteLink(person.profileUrl, "Profile");
  const showProfileLink =
    profileLink &&
    (!preferred || !sameContactHref(profileLink.href, preferred.href));

  const hasCalendar = isRecognizedEmail(person.calendarEmail);
  const bookingLink = parseWebsiteLink(person.availabilityUrl, "Book time");

  const hasAny = preferred || showProfileLink || hasCalendar || bookingLink;

  if (!hasAny) {
    return (
      <p className="text-sm text-gray-500 italic">
        {isSelf
          ? "No contact info yet. You can add it when you log in and edit your profile."
          : "No contact info added yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
      {preferred ? <ContactActionButton contact={preferred} /> : null}

      {showProfileLink ? (
        <SimpleContactLink
          href={profileLink.href}
          label={profileLink.label}
          icon={<Globe className="h-4 w-4" />}
          ariaLabel={`Open profile website for ${person.fullName}`}
        />
      ) : null}

      {hasCalendar ? (
        <SimpleContactLink
          href={buildGoogleCalendarTemplateUrl({
            title: `Meet: ${person.fullName}`,
            details: `Inviting ${person.fullName}.`,
            addGuests: [person.calendarEmail!],
          })}
          label="Invite via Google Calendar"
          icon={<CalendarDays className="h-4 w-4" />}
          ariaLabel={`Create a Google Calendar invite for ${person.fullName}`}
        />
      ) : null}

      {bookingLink ? (
        <SimpleContactLink
          href={bookingLink.href}
          label="Open to meet — book time"
          icon={<Calendar className="h-4 w-4" />}
          ariaLabel={`Book time with ${person.fullName}`}
        />
      ) : null}
    </div>
  );
}
