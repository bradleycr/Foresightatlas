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

/** Maximum custom (non-preset) focus tags per profile. */
export const MAX_CUSTOM_FOCUS_TAGS = 3;

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

/**
 * Parse a comma-separated custom-focus input: trim, dedupe (case-insensitive),
 * and keep at most MAX_CUSTOM_FOCUS_TAGS entries.
 */
export function parseCustomFocusTags(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of value.split(",")) {
    const tag = part.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= MAX_CUSTOM_FOCUS_TAGS) break;
  }
  return result;
}

/** Count unique tags in a comma-separated string (before applying the cap). */
export function countParsedFocusTags(value: string): number {
  const seen = new Set<string>();
  let count = 0;
  for (const part of value.split(",")) {
    const tag = part.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    count++;
  }
  return count;
}

/** Format custom tags for the comma-separated input (capped and deduped). */
export function formatCustomFocusTags(tags: string[] | string): string {
  const value = Array.isArray(tags) ? tags.join(", ") : tags;
  return parseCustomFocusTags(value).join(", ");
}

/** Normalize a stored custom-tag array (cap + dedupe). */
export function normalizeCustomFocusTags(tags: string[]): string[] {
  return parseCustomFocusTags(tags.join(", "));
}

/** Merge preset selections with parsed custom tags for persistence. */
export function mergeFocusTags(presetTags: string[], customInput: string): string[] {
  return [...presetTags, ...parseCustomFocusTags(customInput)];
}
