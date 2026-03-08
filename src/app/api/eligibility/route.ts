import { NextResponse } from "next/server";
import { db } from "@/db";
import { semesters, firms, invites, speakerLogs } from "@/db/schema";
import { eq, desc, asc, and, count } from "drizzle-orm";
import { isEligibleForSemester, type Term } from "@/lib/eligibility";

/**
 * GET ?semesterId=1
 * Returns firms with eligibility for that semester:
 * - eligible: boolean (1-year rule; false for all if semester is full)
 * - lastSpokeSemester: label or null
 * - alreadyInvited: boolean
 * - semesterClosed: boolean (true when capacity is set and remaining slots = 0)
 * - remainingSlots: number | null
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const semesterIdParam = url.searchParams.get("semesterId");
  if (!semesterIdParam) {
    return NextResponse.json({ error: "Missing semesterId" }, { status: 400 });
  }
  const semesterId = parseInt(semesterIdParam, 10);
  const targetSemester = await db.query.semesters.findFirst({
    where: eq(semesters.id, semesterId),
  });
  if (!targetSemester) {
    return NextResponse.json({ error: "Semester not found" }, { status: 404 });
  }
  const targetYear = targetSemester.year;
  const targetTerm = targetSemester.term as Term;

  const cap = targetSemester.speakerCapacity ?? null;
  let remainingSlots: number | null = null;
  let semesterClosed = false;
  if (cap !== null) {
    const [{ value: spokeCount }] = await db
      .select({ value: count() })
      .from(speakerLogs)
      .where(and(eq(speakerLogs.semesterId, semesterId), eq(speakerLogs.outcome, "spoke")));
    remainingSlots = Math.max(0, cap - spokeCount);
    semesterClosed = remainingSlots === 0;
  }

  const allFirms = await db.query.firms.findMany({ orderBy: (f, { asc }) => [asc(f.name)] });
  const sentInvites = await db.query.invites.findMany({
    where: eq(invites.semesterId, semesterId),
  });
  const sentSet = new Set(sentInvites.map((i) => i.firmId));

  // Last spoke from speaker_logs (outcome = 'spoke') so Invites page matches Speaker logs & Firms
  const lastSpokeRows = await db
    .select({
      firmId: speakerLogs.firmId,
      year: semesters.year,
      term: semesters.term,
      label: semesters.label,
    })
    .from(speakerLogs)
    .innerJoin(semesters, eq(speakerLogs.semesterId, semesters.id))
    .where(eq(speakerLogs.outcome, "spoke"))
    .orderBy(desc(semesters.year), asc(semesters.term)); // latest semester first (Fall after Spring)

  const lastByFirmId = new Map<number, { year: number; term: string; label: string }>();
  for (const row of lastSpokeRows) {
    if (!lastByFirmId.has(row.firmId)) {
      lastByFirmId.set(row.firmId, {
        year: row.year,
        term: row.term,
        label: row.label,
      });
    }
  }

  /** Prefer later semester: Fall > Spring for same year. */
  function isNewer(
    a: { year: number; term: string; label: string },
    b: { year: number; term: string; label: string } | undefined
  ): boolean {
    if (!b) return true;
    if (a.year !== b.year) return a.year > b.year;
    return a.term.toLowerCase() === "fall" && b.term.toLowerCase() !== "fall";
  }

  /** Per firm name: same last spoke for all contacts (matches Firms page). */
  const lastByFirmName = new Map<string, { year: number; term: string; label: string }>();
  for (const firm of allFirms) {
    const last = lastByFirmId.get(firm.id);
    if (!last) continue;
    const nameKey = (firm.name ?? "").trim() || String(firm.id);
    const cur = lastByFirmName.get(nameKey);
    if (isNewer(last, cur)) lastByFirmName.set(nameKey, last);
  }

  const result = allFirms.map((firm) => {
    const nameKey = (firm.name ?? "").trim() || String(firm.id);
    const last = lastByFirmName.get(nameKey);
    const eligibleByRule = last
      ? isEligibleForSemester(last.year, last.term as Term, targetYear, targetTerm)
      : true;
    const eligible = semesterClosed ? false : eligibleByRule;
    return {
      ...firm,
      eligible,
      lastSpokeSemester: last?.label ?? null,
      alreadyInvited: sentSet.has(firm.id),
    };
  });

  return NextResponse.json({
    firms: result,
    semesterClosed,
    remainingSlots,
  });
}
