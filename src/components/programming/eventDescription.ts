/**
 * Event description teaser — strips Luma-style markdown and returns
 * a short, readable snippet so cards stay scannable. Full details live on Luma.
 */

const MAX_TEASER_LENGTH = 140;

/** Remove markdown: headers, bold, links, bullets, extra newlines. */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#+\s*/gm, "")           // ## Header
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold**
    .replace(/\*([^*]+)\*/g, "$1")     // *italic*
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url)
    .replace(/\[([^\]]+)\]/g, "$1")    // [label] (no url)
    .replace(/^\s*[-*]\s+/gm, " ")     // list items
    .replace(/\n{2,}/g, "\n")          // collapse newlines
    .replace(/\s+/g, " ")              // collapse spaces
    .trim();
}

/**
 * First paragraph or first MAX_TEASER_LENGTH chars of plain text, with ellipsis.
 * Use for event cards when full description is on Luma.
 */
export function eventDescriptionTeaser(description: string | null | undefined, maxLength = MAX_TEASER_LENGTH): string {
  if (!description?.trim()) return "";
  const plain = stripMarkdown(description);
  if (plain.length <= maxLength) return plain;
  const cut = plain.slice(0, maxLength).replace(/\s+\S*$/, "");
  return cut ? `${cut}\u2026` : "";
}
