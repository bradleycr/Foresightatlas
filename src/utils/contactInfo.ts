/**
 * Parse member contact strings (email, LinkedIn, X handle, GitHub, URLs).
 * Classification is strict so labels, icons, and actions always match.
 */

export type ContactKind = "email" | "linkedin" | "twitter" | "github" | "website";

export interface ParsedContact {
  kind: ContactKind;
  raw: string;
  href: string;
  label: string;
  openLabel: string;
  copyLabel: string;
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;
const CONTACT_SEP_RE = /[,;\n]+/;

function splitContactParts(value: string): string[] {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(CONTACT_SEP_RE)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(trimmed);
  }
  return parts;
}

function truncate(value: string, max = 40): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function hostFromUrl(url: URL): string {
  return url.hostname.replace(/^www\./i, "").toLowerCase();
}

function tryParseUrl(raw: string): URL | null {
  const candidates = HTTP_URL_RE.test(raw)
    ? [raw]
    : /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)
      ? [`https://${raw}`]
      : [];

  for (const candidate of candidates) {
    try {
      return new URL(candidate);
    } catch {
      // try next
    }
  }
  return null;
}

/** True when the value is a recognizable contact (email, URL, or @handle). */
export function isRecognizedContact(value: string | null | undefined): boolean {
  return parseContacts(value).length > 0;
}

/** True when the value is a plain email address. */
export function isRecognizedEmail(value: string | null | undefined): boolean {
  const raw = (value ?? "").trim();
  return Boolean(raw) && EMAIL_RE.test(raw) && raw.length <= 120;
}

/** True when the value is an http(s) URL. */
export function isRecognizedUrl(value: string | null | undefined): boolean {
  const raw = (value ?? "").trim();
  if (!raw || raw.length > 220) return false;
  return tryParseUrl(raw) !== null;
}

/** Classify preferred contact (email, URL, or @handle). */
export function parseContact(value: string | null | undefined): ParsedContact | null {
  const contacts = parseContacts(value);
  return contacts[0] ?? null;
}

/** Parse one or more contacts from a comma/semicolon-separated string. */
export function parseContacts(value: string | null | undefined): ParsedContact[] {
  const raw = (value ?? "").trim();
  if (!raw || raw.length > 500) return [];

  const parts = splitContactParts(raw);
  const candidates = parts.length > 0 ? parts : [raw];
  const seen = new Set<string>();
  const contacts: ParsedContact[] = [];

  for (const part of candidates) {
    const parsed = parseSingleContact(part);
    if (!parsed) continue;
    const key = parsed.href.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    contacts.push(parsed);
  }

  return contacts;
}

function parseSingleContact(raw: string): ParsedContact | null {
  if (!raw || raw.length > 250) return null;

  if (/^@[\w.]{1,49}$/i.test(raw)) {
    const handle = raw.slice(1);
    return {
      kind: "twitter",
      raw,
      href: `https://x.com/${handle}`,
      label: raw,
      openLabel: "Open on X",
      copyLabel: "Copy handle",
    };
  }

  if (EMAIL_RE.test(raw) && raw.length <= 120) {
    return {
      kind: "email",
      raw,
      href: `mailto:${raw}`,
      label: truncate(raw),
      openLabel: "Send email",
      copyLabel: "Copy email address",
    };
  }

  const url = tryParseUrl(raw);
  if (!url) return null;

  const host = hostFromUrl(url);
  const href = url.toString();

  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
    return {
      kind: "linkedin",
      raw,
      href,
      label: "LinkedIn",
      openLabel: "Open LinkedIn profile",
      copyLabel: "Copy LinkedIn link",
    };
  }

  if (host === "twitter.com" || host === "x.com") {
    return {
      kind: "twitter",
      raw,
      href,
      label: "X profile",
      openLabel: "Open on X",
      copyLabel: "Copy profile link",
    };
  }

  if (host === "github.com") {
    return {
      kind: "github",
      raw,
      href,
      label: "GitHub",
      openLabel: "Open GitHub profile",
      copyLabel: "Copy GitHub link",
    };
  }

  return {
    kind: "website",
    raw,
    href,
    label: truncate(host, 28),
    openLabel: "Open link",
    copyLabel: "Copy link",
  };
}

/** Parse a standalone website / profile URL. */
export function parseWebsiteLink(
  value: string | null | undefined,
  label = "Website",
): ParsedContact | null {
  const raw = (value ?? "").trim();
  if (!raw || raw.length > 220) return null;
  const url = tryParseUrl(raw);
  if (!url) return null;
  const host = hostFromUrl(url);
  return {
    kind: "website",
    raw,
    href: url.toString(),
    label: label === "Website" ? truncate(host, 28) : label,
    openLabel: `Open ${label.toLowerCase()}`,
    copyLabel: "Copy link",
  };
}

/** Compare two links after normalizing scheme, host, and trailing slashes. */
export function sameContactHref(a: string, b: string): boolean {
  try {
    const left = new URL(a).toString().replace(/\/$/, "").toLowerCase();
    const right = new URL(b).toString().replace(/\/$/, "").toLowerCase();
    return left === right;
  } catch {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
}
