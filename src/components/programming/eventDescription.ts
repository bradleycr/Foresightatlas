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
 * Escape HTML so we can safely inject description text.
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (ch) => map[ch] ?? ch);
}

/**
 * Convert event description (markdown-style from Luma/Sheet) to safe HTML for display:
 * newlines → <br />, **bold** → <strong>, *italic* → <em>. Links are stripped to text.
 */
export function formatEventDescriptionToHtml(description: string | null | undefined): string {
  if (!description?.trim()) return "";
  const escaped = escapeHtml(description);
  return escaped
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url) → label only
    .replace(/\n{2,}/g, "</p><p class=\"mt-2\">")
    .replace(/\n/g, "<br />")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/^/, '<p class="first:mt-0">')
    .replace(/$/, "</p>");
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
