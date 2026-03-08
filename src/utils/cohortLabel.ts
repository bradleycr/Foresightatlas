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

const DEFAULT_REFERENCE_YEAR = () => new Date().getFullYear();

/**
 * True if the person should be treated as alumni for display and filtering:
 * - Sheet says isAlumni, or
 * - They have an end year in the past, or
 * - Their cohort year is in the past (e.g. 2025 when reference is 2026).
 * Uses referenceYear so filtering/display stay consistent (default: current year).
 */
export function effectiveIsAlumni(
  person: Pick<Person, "isAlumni" | "fellowshipCohortYear" | "fellowshipEndYear"> | null | undefined,
  referenceYear: number = DEFAULT_REFERENCE_YEAR(),
): boolean {
  if (person == null) return false;
  if (person.isAlumni) return true;
  if (person.fellowshipEndYear != null && person.fellowshipEndYear < referenceYear) return true;
  if (person.fellowshipCohortYear >= 1900 && person.fellowshipCohortYear < referenceYear) return true;
  return false;
}

/**
 * For sidebar/modal: show "Alumni" for past-cohort members, otherwise the cohort label (e.g. "2026" or "2019–2022").
 * When alumni, use this alone (e.g. "Alumni"); when current, use "Cohort {getCohortDisplayLabel(person)}" which is just the year(s).
 */
export function getCohortDisplayLabel(
  person: Pick<Person, "isAlumni" | "fellowshipCohortYear" | "fellowshipEndYear">,
  referenceYear: number = DEFAULT_REFERENCE_YEAR(),
): string {
  return effectiveIsAlumni(person, referenceYear) ? "Alumni" : getCohortLabel(person);
}
