function clean(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export function buildGoogleCalendarTemplateUrl(options: {
  title?: string | null;
  details?: string | null;
  location?: string | null;
  /** ISO string or Date. If omitted, Google Calendar will leave time unset. */
  start?: string | Date | null;
  /** ISO string or Date. If omitted, Google Calendar will leave time unset. */
  end?: string | Date | null;
  /** One or more guest emails. */
  addGuests?: Array<string | null | undefined>;
}): string {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");

  const text = clean(options.title);
  if (text) params.set("text", text);

  const details = clean(options.details);
  if (details) params.set("details", details);

  const location = clean(options.location);
  if (location) params.set("location", location);

  const toUtcCompact = (value: string | Date | null | undefined): string | null => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(d.getTime())) return null;
    // Google Calendar expects RFC5545-ish UTC timestamps: YYYYMMDDTHHmmssZ
    const iso = d.toISOString(); // 2026-01-02T03:04:05.000Z
    return iso.replace(/[-:]/g, "").replace(".000Z", "Z");
  };

  const start = toUtcCompact(options.start);
  const end = toUtcCompact(options.end);
  if (start && end) params.set("dates", `${start}/${end}`);

  const guests = (options.addGuests ?? [])
    .map((g) => clean(g ?? ""))
    .filter((g) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g));
  if (guests.length > 0) params.set("add", guests.join(","));

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

