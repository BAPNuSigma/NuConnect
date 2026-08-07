import { NextResponse } from "next/server";
import { db } from "@/db";
import { semesters, firms, invites, speakerLogs } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { isEligibleForSemester, type Term } from "@/lib/eligibility";
import { getLastSpokeByOrganization } from "@/lib/last-spoke";

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

  // Keyed by organizationId so every contact at the same company shares one eligibility
  // state (matches send-invites-batch and send-invite).
  const lastByOrg = await getLastSpokeByOrganization(db);

  const result = allFirms.map((firm) => {
    const last = firm.organizationId != null ? lastByOrg.get(firm.organizationId) : undefined;
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
