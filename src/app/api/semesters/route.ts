import { NextResponse } from "next/server";
import { db } from "@/db";
import { semesters, speakerLogs } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { z } from "zod";

const createBody = z.object({
  year: z.number().int().min(2000).max(2100),
  term: z.enum(["spring", "fall"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  speakerCapacity: z.number().int().min(0).optional().nullable(),
});
const updateBody = z.object({
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  speakerCapacity: z.number().int().min(0).optional().nullable(),
});
type Term = "spring" | "fall";

function label(year: number, term: Term): string {
  const cap = term.charAt(0).toUpperCase() + term.slice(1);
  return `${cap} ${year}`;
}

/** Count of speaker_logs with outcome 'spoke' per semester (filled slots) */
async function getSpokeCountsBySemester(): Promise<Map<number, number>> {
  const rows = await db
    .select({
      semesterId: speakerLogs.semesterId,
      spokeCount: count(),
    })
    .from(speakerLogs)
    .where(eq(speakerLogs.outcome, "spoke"))
    .groupBy(speakerLogs.semesterId);
  return new Map(rows.map((r) => [r.semesterId, r.spokeCount]));
}

export async function GET() {
  const list = await db.query.semesters.findMany({
    orderBy: [desc(semesters.year), desc(semesters.term)],
  });
  const spokeCounts = await getSpokeCountsBySemester();
  const result = list.map((s) => {
    const filled = spokeCounts.get(s.id) ?? 0;
    const cap = s.speakerCapacity ?? null;
    const remaining = cap === null ? null : Math.max(0, cap - filled);
    return {
      ...s,
      filledSlots: filled,
      remainingSlots: remaining,
      isFull: cap !== null && remaining === 0,
    };
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const [row] = await db.insert(semesters).values({
    year: parsed.data.year,
    term: parsed.data.term,
    label: label(parsed.data.year, parsed.data.term),
    startDate: parsed.data.startDate ?? null,
    endDate: parsed.data.endDate ?? null,
    speakerCapacity: parsed.data.speakerCapacity ?? null,
  }).returning();
  return NextResponse.json(row);
}

export async function PATCH(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const body = await request.json();
  const parsed = updateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const [row] = await db.update(semesters).set({
    ...(parsed.data.startDate !== undefined && { startDate: parsed.data.startDate ?? null }),
    ...(parsed.data.endDate !== undefined && { endDate: parsed.data.endDate ?? null }),
    ...(parsed.data.speakerCapacity !== undefined && { speakerCapacity: parsed.data.speakerCapacity ?? null }),
  }).where(eq(semesters.id, parseInt(id, 10))).returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.delete(semesters).where(eq(semesters.id, parseInt(id, 10)));
  return NextResponse.json({ ok: true });
}
