/**
 * Opens the member's mail app with a short bug-report draft.
 * The visible label never names a person — the address lives only in the mailto.
 */

import { atlasBugReportMailto } from "../utils/checkInAuth";

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
  return (
    <a href={atlasBugReportMailto({ error })} className={className}>
      {children}
    </a>
  );
}
