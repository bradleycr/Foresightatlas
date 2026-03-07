/**
 * Canonical focus areas used across the app.
 *
 * PRESET_FOCUS_AREAS — the main company focus areas. Used for:
 * - Map/timeline filtering (only these are filterable)
 * - Profile multi-select (users pick from these)
 *
 * "Other" is not in the preset list: users can add custom focus tags via "Other";
 * custom tags appear on the profile but are not used for map filtering.
 */

/** The six main focus areas; used for filtering and for profile selection. */
export const PRESET_FOCUS_AREAS: readonly string[] = [
  "Secure AI",
  "Neurotechnology",
  "Longevity Biotechnology",
  "Nanotechnology",
  "Space",
  "Existential Hope",
] as const;

/** Whether a tag is one of the preset (filterable) focus areas. */
export function isPresetFocusTag(tag: string): boolean {
  return PRESET_FOCUS_AREAS.includes(tag);
}

/** Tags from a person's focusTags that are preset (used for map filtering). */
export function getPresetFocusTags(focusTags: string[]): string[] {
  return focusTags.filter((t) => isPresetFocusTag(t));
}

/** Tags from a person's focusTags that are custom (profile-only, not filterable). */
export function getCustomFocusTags(focusTags: string[]): string[] {
  return focusTags.filter((t) => !isPresetFocusTag(t));
}

/** Parse comma-separated focus tag string; trim each part, drop empties. */
export function parseFocusTags(value: string): string[] {
  return value.split(",").map((t) => t.trim()).filter(Boolean);
}
