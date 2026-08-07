import { db } from "@/db";
import { speakerLogs, semesters, firms } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import type { Term } from "./eligibility";

export type LastSpoke = { year: number; term: Term; label: string };

/**
 * Most recent semester each organization actually spoke (speakerLogs.outcome = 'spoke'),
 * keyed by organizationId so every contact at a company shares the same eligibility.
 * Rows are ordered latest-first: desc(year), then asc(term) puts "fall" before "spring"
 * alphabetically, which also happens to be latest-in-year-first.
 */
export async function getLastSpokeByOrganization(dbInstance: typeof db): Promise<Map<number, LastSpoke>> {
  const rows = await dbInstance
    .select({
      organizationId: firms.organizationId,
      year: semesters.year,
      term: semesters.term,
      label: semesters.label,
    })
    .from(speakerLogs)
    .innerJoin(semesters, eq(speakerLogs.semesterId, semesters.id))
    .innerJoin(firms, eq(speakerLogs.firmId, firms.id))
    .where(eq(speakerLogs.outcome, "spoke"))
    .orderBy(desc(semesters.year), asc(semesters.term));

  const map = new Map<number, LastSpoke>();
  for (const row of rows) {
    if (row.organizationId == null) continue;
    if (!map.has(row.organizationId)) {
      map.set(row.organizationId, { year: row.year, term: row.term as Term, label: row.label });
    }
  }
  return map;
}
