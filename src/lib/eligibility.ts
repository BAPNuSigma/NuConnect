/**
 * Eligibility rule: a firm cannot come back to speak within one year.
 * If they spoke in Spring 2026, they are not eligible until Spring 2027.
 */

export type Term = "spring" | "fall";

export function semesterLabel(year: number, term: Term): string {
  const cap = term.charAt(0).toUpperCase() + term.slice(1);
  return `${cap} ${year}`;
}

/**
 * Returns true if the firm is eligible to be invited for the given semester.
 * They must not have spoken in the same semester in the previous year or any later semester.
 */
export function isEligibleForSemester(
  lastSpokeYear: number,
  lastSpokeTerm: Term,
  targetYear: number,
  targetTerm: Term
): boolean {
  if (targetYear > lastSpokeYear) return true;
  if (targetYear < lastSpokeYear) return false;
  // same year: must be later term (e.g. spoke Spring, inviting Fall is ok only if we consider "same year" as 1 year - per user: "within one year" = not until same semester next year)
  // So: spoke Spring 2026 -> eligible Spring 2027. So we need (targetYear, targetTerm) > (lastSpokeYear, lastSpokeTerm) in "semester order" with 1 year gap.
  // Simplest: eligible if targetYear >= lastSpokeYear + 1, OR (targetYear === lastSpokeYear + 1 is the first eligible). So targetYear > lastSpokeYear, or (targetYear === lastSpokeYear + 1 and any term).
  // Actually: "cannot come back within one year" = can come back for the same semester next year. So eligible iff (targetYear > lastSpokeYear) OR (targetYear === lastSpokeYear + 1 && targetTerm >= lastSpokeTerm)? No.
  // User said: "if the firm spoke to us in the spring 2026 semester, they would not be eligible until the spring 2027 semester". So eligible for Spring 2027, not for Fall 2026. So:
  // Eligible when: targetYear > lastSpokeYear, OR (targetYear === lastSpokeYear + 1 && targetTerm === lastSpokeTerm) ... no, that would mean only Spring 2027. So they're eligible for Spring 2027 and any later semester. So:
  // Eligible when (targetYear, targetTerm) is strictly after (lastSpokeYear + 1, lastSpokeTerm) in semester order? No - "until spring 2027" means spring 2027 is the first eligible. So:
  // (targetYear > lastSpokeYear) OR (targetYear === lastSpokeYear + 1 && targetTerm === lastSpokeTerm). So only Spring 2027 for that example. And for Fall 2026 speaker, eligible from Fall 2027.
  if (targetYear === lastSpokeYear + 1 && targetTerm === lastSpokeTerm) return true;
  if (targetYear > lastSpokeYear + 1) return true;
  return false;
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
