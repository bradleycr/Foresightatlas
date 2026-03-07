import { Person } from "../types";

/**
 * Format cohort as a single year or range (e.g. "2023" or "2019–2022").
 * Unknown cohort (0) is shown as "—" (all-time).
 */
export function getCohortLabel(person: Pick<Person, "fellowshipCohortYear" | "fellowshipEndYear">): string {
  const start = person.fellowshipCohortYear;
  if (!start || start < 1900) return "—";
  const end = person.fellowshipEndYear ?? null;
  if (end == null || end === start) return String(start);
  return `${start}–${end}`;
}
