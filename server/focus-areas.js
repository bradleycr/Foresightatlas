/**
 * Server-side focus tag normalization (mirrors src/data/focusAreas.ts).
 */

const PRESET_FOCUS_AREAS = new Set([
  "Secure AI",
  "Neurotechnology",
  "Longevity Biotechnology",
  "Nanotechnology",
  "Space",
  "Existential Hope",
]);

const MAX_CUSTOM_FOCUS_TAGS = 3;

function isPresetFocusTag(tag) {
  return PRESET_FOCUS_AREAS.has(tag);
}

function parseCustomFocusTags(value) {
  const seen = new Set();
  const result = [];
  for (const part of String(value).split(",")) {
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

/** Keep all preset tags; cap and dedupe custom tags. */
function normalizeFocusTags(tags) {
  if (!Array.isArray(tags)) return [];
  const presets = [];
  const customs = [];
  for (const raw of tags) {
    const tag = String(raw).trim();
    if (!tag) continue;
    if (isPresetFocusTag(tag)) presets.push(tag);
    else customs.push(tag);
  }
  return [...presets, ...parseCustomFocusTags(customs.join(", "))];
}

module.exports = {
  MAX_CUSTOM_FOCUS_TAGS,
  normalizeFocusTags,
  parseCustomFocusTags,
};
