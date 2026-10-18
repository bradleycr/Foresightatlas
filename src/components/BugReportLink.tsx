/**
 * Inline “email our team” link. Uses Gmail compose so the draft opens in the
 * browser; mailto alone often fails when no desktop client is configured.
 */

import { atlasBugReportComposeUrls } from "../utils/checkInAuth";

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
  const { gmail } = atlasBugReportComposeUrls({ error });
  return (
    <a
      href={gmail}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
