/**
 * Tiny consent line for claim / join — community-only sharing, no sale of data.
 */

import { buildFullPath } from "../../utils/router";

interface PrivacyConsentNoteProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  id?: string;
}

export function PrivacyConsentNote({
  checked,
  onCheckedChange,
  id = "privacy-consent",
}: PrivacyConsentNoteProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-gray-600"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-gray-300 text-teal-700 focus:ring-teal-500/40"
      />
      <span>
        By creating an account, I agree my profile can appear to signed-in
        Foresight community members on this atlas. We don’t sell your data or
        share it outside this community.{" "}
        <a
          href={buildFullPath("/privacy")}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-gray-900 underline underline-offset-2 hover:no-underline"
          onClick={(event) => event.stopPropagation()}
        >
          Privacy &amp; data
        </a>
      </span>
    </label>
  );
}
