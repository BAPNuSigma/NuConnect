/**
 * Eligibility rule: a firm cannot come back to speak within one year.
 * They are blocked until the same term one year after they last spoke:
 * - Spoke Spring 2026 -> not eligible for Fall 2026, eligible from Spring 2027.
 * - Spoke Fall 2026 -> not eligible for Spring 2027, eligible from Fall 2027.
 */

export type Term = "spring" | "fall";

/** Spring comes before Fall within a calendar year. */
const TERM_ORDER: Record<Term, number> = { spring: 0, fall: 1 };

export function semesterLabel(year: number, term: Term): string {
  const cap = term.charAt(0).toUpperCase() + term.slice(1);
  return `${cap} ${year}`;
}

/**
 * Returns true if the firm is eligible to be invited for the given semester.
 * They are ineligible until the same term one year after they last spoke:
 * spoke Spring 2026 -> eligible from Spring 2027; spoke Fall 2026 -> eligible from Fall 2027.
 */
export function isEligibleForSemester(
  lastSpokeYear: number,
  lastSpokeTerm: Term,
  targetYear: number,
  targetTerm: Term
): boolean {
  if (targetYear > lastSpokeYear + 1) return true;
  if (targetYear <= lastSpokeYear) return false;
  // Target is exactly one year after they spoke: eligible only from the same term onward.
  return TERM_ORDER[targetTerm] >= TERM_ORDER[lastSpokeTerm];
}

export function isEligibleForSemesterByLabel(
  lastSpokeLabel: string,
  targetLabel: string
): boolean {
  const parse = (s: string) => {
    const [termStr, yearStr] = s.trim().split(/\s+/);
    const term = termStr?.toLowerCase() === "fall" ? "fall" : "spring";
    const year = parseInt(yearStr ?? "0", 10);
    return { year, term } as { year: number; term: Term };
  };
  const last = parse(lastSpokeLabel);
  const target = parse(targetLabel);
  return isEligibleForSemester(last.year, last.term, target.year, target.term);
}
