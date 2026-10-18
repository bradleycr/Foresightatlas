/**
 * Inline “email our team” link. Phones use mailto so iOS opens the mail app.
 * Desktop uses a Gmail compose tab, which is where a drafted message actually opens.
 */

import { atlasBugReportComposeUrls, atlasBugReportMailto, isPhoneBrowser } from "../utils/checkInAuth";

interface BugReportLinkProps {
  className?: string;
  /** Known failure text, folded into the draft so the team can see it. */
  error?: string;
  children?: string;
}

export function BugReportLink({
  className,
  error,
  children = "Report a bug",
}: BugReportLinkProps) {
  const href = isPhoneBrowser()
    ? atlasBugReportMailto({ error })
    : atlasBugReportComposeUrls({ error }).gmail;
  return (
    <a
      href={href}
      {...(isPhoneBrowser() ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      className={className}
    >
      {children}
    </a>
  );
}
