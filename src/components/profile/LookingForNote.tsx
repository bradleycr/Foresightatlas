/**
 * The one-sentence ask under a profile's Details.
 *
 * Shown only when the member has written one. An empty prompt on every
 * profile would sit under bios that are already complete.
 */

/** Matches the server check in profile-store.js. */
export const LOOKING_FOR_MAX_LENGTH = 220;

export function lookingForSentence(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function LookingForNote({ text }: { text: string }) {
  const sentence = lookingForSentence(text);
  if (!sentence) return null;

  return (
    <div className="mt-4 rounded-2xl border border-stone-200/90 bg-stone-50 px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
        Looking for
      </p>
      <p className="mt-1 text-sm leading-relaxed text-stone-900">{sentence}</p>
    </div>
  );
}
