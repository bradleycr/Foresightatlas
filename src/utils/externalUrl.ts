/**
 * Normalize external links coming from Sheets/Luma so UI always receives a valid URL.
 */
export function normalizeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Legacy bad format seen in synced data: https://lu.ma/https://luma.com/<slug>
  const nestedLuma = trimmed.match(/^https?:\/\/lu\.ma\/(https?:\/\/.+)$/i);
  if (nestedLuma?.[1]) {
    return normalizeExternalUrl(nestedLuma[1]);
  }

  // Bare Luma slug (e.g. "abcd1234")
  if (/^[a-z0-9_-]{6,}$/i.test(trimmed)) {
    return `https://lu.ma/${trimmed}`;
  }

  // Domain without scheme (e.g. luma.com/abc)
  if (/^(lu\.ma|luma\.com)\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const u = new URL(withProtocol);
    return u.toString();
  } catch {
    return null;
  }
}

export function isLumaUrl(href: string | null | undefined): boolean {
  const normalized = normalizeExternalUrl(href);
  if (!normalized) return false;
  try {
    const u = new URL(normalized);
    return u.hostname === "lu.ma" || u.hostname === "luma.com" || u.hostname.endsWith(".luma.com");
  } catch {
    return false;
  }
}
