/**
 * BugReportFab — a corner shortcut that never joins the page layout.
 * Fixed, so maps, lists, and forms keep their full height. It sits above
 * the map credit line and the desktop footer, and under sheets and dialogs.
 */

import { Bug } from "lucide-react";
import { Z_INDEX_BUG_REPORT } from "../constants/zIndex";
import { atlasBugReportMailto } from "../utils/checkInAuth";

export function BugReportFab() {
  return (
    <a
      href={atlasBugReportMailto()}
      aria-label="Report a bug"
      className="fixed right-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/80 bg-white/95 py-1.5 pl-1.5 pr-1.5 text-sm font-medium text-gray-800 shadow-[0_8px_24px_rgba(15,23,42,0.14)] backdrop-blur-sm transition-transform hover:bg-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 touch-manipulation bottom-[max(2.75rem,calc(env(safe-area-inset-bottom,0px)+2.25rem))] min-[360px]:pr-3 md:bottom-[4.75rem]"
      style={{ zIndex: Z_INDEX_BUG_REPORT }}
    >
      <span
        className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-amber-700"
        aria-hidden
      >
        <Bug className="size-4 -rotate-12" />
      </span>
      <span className="hidden pr-0.5 min-[360px]:inline">Report a bug</span>
    </a>
  );
}
