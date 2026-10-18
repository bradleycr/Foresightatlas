/**
 * BugReportFab — compact map-chrome control in the corner.
 * Opens a small menu of mail providers with a prefilled draft (mailto alone
 * often opens a blank tab when no desktop client is configured).
 */

import { Bug, ExternalLink, Mail } from "lucide-react";
import { Z_INDEX_BUG_REPORT } from "../constants/zIndex";
import { atlasBugReportComposeUrls } from "../utils/checkInAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

function openCompose(kind: "gmail" | "outlook" | "mailto") {
  const urls = atlasBugReportComposeUrls();
  if (kind === "mailto") {
    // Same-tab: target=_blank on mailto is what produces empty browser tabs.
    window.location.href = urls.mailto;
    return;
  }
  window.open(urls[kind], "_blank", "noopener,noreferrer");
}

export function BugReportFab() {
  return (
    <div
      className="fixed right-3 bottom-[max(2.5rem,calc(env(safe-area-inset-bottom,0px)+1.75rem))] md:bottom-[4.25rem]"
      style={{ zIndex: Z_INDEX_BUG_REPORT }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Report a bug"
            title="Report a bug"
            className="inline-flex size-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-1 touch-manipulation"
          >
            <Bug className="size-3.5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="top"
          sideOffset={6}
          className="z-[1300] min-w-[11.5rem] border-gray-200 bg-white text-gray-800 shadow-md"
        >
          <DropdownMenuLabel className="text-xs font-medium text-gray-500">
            Report a bug
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => openCompose("gmail")}
          >
            <ExternalLink className="size-3.5 text-gray-500" aria-hidden />
            Gmail
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => openCompose("outlook")}
          >
            <ExternalLink className="size-3.5 text-gray-500" aria-hidden />
            Outlook
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => openCompose("mailto")}
          >
            <Mail className="size-3.5 text-gray-500" aria-hidden />
            Mail app
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
