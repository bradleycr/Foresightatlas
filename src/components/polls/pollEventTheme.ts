/**
 * Room chrome for a poll. The tool stays one product — the event name on the
 * poll picks the dressing. Unknown events keep the plain Atlas paper.
 */

export interface PollEventTheme {
  id: "vision-weekend" | "impact-lab" | "atlas";
  /** Small line above the question. */
  kicker: string;
  /** Place and date, under the kicker. */
  detail: string;
  pageBackground: string;
  /** The slip the question sits on. Always light enough to vote on. */
  ticketClass: string;
  kickerClass: string;
  detailClass: string;
  inkClass: string;
  mutedClass: string;
}

const ATLAS: PollEventTheme = {
  id: "atlas",
  kicker: "Foresight",
  detail: "",
  pageBackground: "linear-gradient(180deg, #f7f6f3 0%, #ffffff 46%, #efece6 100%)",
  ticketClass: "border-white/80 bg-white/95 text-gray-900",
  kickerClass: "text-neutral-500",
  detailClass: "text-neutral-500",
  inkClass: "text-[var(--primary)]",
  mutedClass: "text-gray-600",
};

/**
 * Vision Weekend USA 2026 — Nov 13–15, San Francisco.
 * 40th anniversary of the institute. Night and gilt, not the Atlas paper.
 */
const VISION_WEEKEND: PollEventTheme = {
  id: "vision-weekend",
  kicker: "Vision Weekend USA",
  detail: "Nov 13–15 · San Francisco · 40 years",
  pageBackground:
    "radial-gradient(120% 80% at 10% 0%, #3a2a14 0%, transparent 46%), linear-gradient(165deg, #14110d 0%, #0c0b09 55%, #1a120c 100%)",
  ticketClass: "border-[#e4c27a]/35 bg-[#f7f1e6] text-[#1a140c]",
  kickerClass: "text-[#e4c27a]",
  detailClass: "text-[#d9cbb6]/80",
  inkClass: "text-[#f6f1e7]",
  mutedClass: "text-[#d9cbb6]/75",
};

/**
 * Claude Impact Lab — CIC Berlin, 7 Nov 2026.
 * A work day, not a gala: warm paper and a clay mark.
 */
const IMPACT_LAB: PollEventTheme = {
  id: "impact-lab",
  kicker: "Claude Impact Lab",
  detail: "CIC Berlin · 7 Nov",
  pageBackground:
    "linear-gradient(165deg, #f4efe6 0%, #fffdf8 42%, #efe4d4 100%)",
  ticketClass: "border-[#e7d3bc] bg-white text-[#1c1915]",
  kickerClass: "text-[#9a4b2f]",
  detailClass: "text-[#6b5c4e]",
  inkClass: "text-[#1c1915]",
  mutedClass: "text-[#5c534a]",
};

export function themeForEvent(eventTitle: string | null | undefined): PollEventTheme {
  const title = String(eventTitle || "").toLowerCase();
  if (!title) return ATLAS;
  if (/vision\s*weekend/.test(title)) return VISION_WEEKEND;
  if (/impact\s*lab/.test(title) || /\bclaude\b/.test(title)) return IMPACT_LAB;
  return { ...ATLAS, kicker: eventTitle!.trim() };
}
