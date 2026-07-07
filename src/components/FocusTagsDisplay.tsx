/**
 * Focus tag pills for profile surfaces (modal, /profile editor header).
 * Preset areas and custom "Other" tags are both shown here.
 * Map sidebar cards intentionally show presets only — see FellowCard.
 */

import { getCustomFocusTags, getPresetFocusTags, normalizeCustomFocusTags } from "../data/focusAreas";
import { Badge } from "./ui/badge";
import { cn } from "./ui/utils";

interface FocusTagsDisplayProps {
  focusTags: string[];
  className?: string;
  /** Extra classes on each preset badge (e.g. person-detail modal). */
  presetBadgeClassName?: string;
  customBadgeClassName?: string;
  otherBadgeClassName?: string;
}

export function FocusTagsDisplay({
  focusTags,
  className,
  presetBadgeClassName,
  customBadgeClassName,
  otherBadgeClassName,
}: FocusTagsDisplayProps) {
  const presetTags = getPresetFocusTags(focusTags);
  const customTags = normalizeCustomFocusTags(getCustomFocusTags(focusTags));
  if (presetTags.length === 0 && customTags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2 sm:gap-2.5", className)}>
      {presetTags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className={cn("text-xs font-normal", presetBadgeClassName)}
        >
          {tag}
        </Badge>
      ))}
      {customTags.length > 0 && (
        <>
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-normal text-gray-600 border-gray-300",
              otherBadgeClassName,
            )}
          >
            Other
          </Badge>
          {customTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className={cn(
                "text-xs font-normal bg-gray-100 text-gray-700",
                customBadgeClassName,
              )}
            >
              {tag}
            </Badge>
          ))}
        </>
      )}
    </div>
  );
}
