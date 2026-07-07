/**
 * Custom focus tag input — comma-separated, live preview, max 3 areas.
 * When CUSTOM_FOCUS_AREAS_ENABLED is false, shows a disabled "Coming soon" state.
 */

import { useId } from "react";
import {
  CUSTOM_FOCUS_AREAS_ENABLED,
  MAX_CUSTOM_FOCUS_TAGS,
  countParsedFocusTags,
  formatCustomFocusTags,
  parseCustomFocusTags,
} from "../data/focusAreas";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface CustomFocusInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

export function CustomFocusInput({ value, onChange, id: idProp }: CustomFocusInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;

  if (!CUSTOM_FOCUS_AREAS_ENABLED) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3 opacity-70">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs font-medium text-gray-400">Other (optional)</Label>
          <Badge variant="outline" className="text-[10px] font-medium text-gray-500 border-gray-300">
            Coming soon
          </Badge>
        </div>
        <p className="mt-1.5 text-xs text-gray-400">
          Custom focus areas aren&apos;t available yet. For now, pick from the six main areas above.
        </p>
        <Input
          disabled
          tabIndex={-1}
          aria-hidden
          value=""
          placeholder="e.g. Cognitive Science, Design"
          className="mt-2 cursor-not-allowed bg-gray-100 text-gray-400"
        />
      </div>
    );
  }

  const previewTags = parseCustomFocusTags(value);
  const overLimit = countParsedFocusTags(value) > MAX_CUSTOM_FOCUS_TAGS;

  const handleBlur = () => {
    const normalized = formatCustomFocusTags(value);
    if (normalized !== value) onChange(normalized);
  };

  return (
    <div>
      <Label htmlFor={id} className="text-xs font-medium text-gray-500">
        Other (optional)
      </Label>
      <p className="mt-0.5 text-xs text-gray-500">
        Separate with commas (e.g. Cognitive Science, Design). Up to{" "}
        {MAX_CUSTOM_FOCUS_TAGS} custom areas — shown on your profile only, not map
        filters or sidebar cards.
      </p>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="e.g. Cognitive Science, Design"
        className="mt-1"
        aria-describedby={overLimit ? `${id}-limit-hint` : previewTags.length ? `${id}-preview` : undefined}
      />
      {previewTags.length > 0 && (
        <div
          id={`${id}-preview`}
          className="mt-2 flex flex-wrap gap-1.5"
          aria-live="polite"
        >
          {previewTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-xs font-normal bg-gray-100 text-gray-700"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
      {overLimit && (
        <p id={`${id}-limit-hint`} className="mt-1.5 text-xs text-amber-800" role="status">
          Only the first {MAX_CUSTOM_FOCUS_TAGS} areas are kept.
        </p>
      )}
    </div>
  );
}
