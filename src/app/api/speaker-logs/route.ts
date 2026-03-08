import { NextResponse } from "next/server";
import { db } from "@/db";
import { speakerLogs, events, firms, semesters } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";
import { z } from "zod";

const outcomeEnum = z.enum(["confirm", "spoke", "cancel", "rescheduled"]);
const createBody = z.object({
  firmId: z.number().int(),
  semesterId: z.number().int(),
  eventId: z.number().int().optional(),
  logDate: z.string().min(1),
  outcome: outcomeEnum.optional(),
  thankYouSent: z.boolean().optional(),
  thankYouSentAt: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const firmIdParam = url.searchParams.get("firmId");
    const semesterIdParam = url.searchParams.get("semesterId");

    // Use explicit select + joins so we always get rows (no reliance on relational query API)
    let query = db
      .select({
        id: speakerLogs.id,
        firmId: speakerLogs.firmId,
        semesterId: speakerLogs.semesterId,
        logDate: speakerLogs.logDate,
        outcome: speakerLogs.outcome,
        thankYouSent: speakerLogs.thankYouSent,
        thankYouSentAt: speakerLogs.thankYouSentAt,
        notes: speakerLogs.notes,
        firmId_firm: firms.id,
        firmName: firms.name,
        firmDiscipline: firms.discipline,
        firmContactFirstName: firms.contactFirstName,
        firmContactLastName: firms.contactLastName,
        firmContactName: firms.contactName,
        semesterId_sem: semesters.id,
        semesterLabel: semesters.label,
        semesterYear: semesters.year,
      })
      .from(speakerLogs)
      .leftJoin(firms, eq(speakerLogs.firmId, firms.id))
      .leftJoin(semesters, eq(speakerLogs.semesterId, semesters.id));

    if (firmIdParam) {
      query = query.where(eq(speakerLogs.firmId, parseInt(firmIdParam, 10))) as typeof query;
    } else if (semesterIdParam) {
      query = query.where(eq(speakerLogs.semesterId, parseInt(semesterIdParam, 10))) as typeof query;
    }

    const rows = await query.orderBy(desc(speakerLogs.id));

    const body = rows.map((row) => ({
      id: row.id,
      firmId: row.firmId,
      semesterId: row.semesterId,
      logDate: row.logDate,
      outcome: row.outcome ?? "confirm",
      thankYouSent: row.thankYouSent ?? false,
      thankYouSentAt: row.thankYouSentAt ?? null,
      notes: row.notes ?? null,
      firm:
        row.firmId_firm != null
          ? {
              id: row.firmId_firm,
              name: row.firmName ?? "",
              discipline: row.firmDiscipline ?? null,
              contactFirstName: row.firmContactFirstName ?? null,
              contactLastName: row.firmContactLastName ?? null,
              contactName: row.firmContactName ?? null,
            }
          : null,
      semester:
        row.semesterId_sem != null
          ? {
              id: row.semesterId_sem,
              label: row.semesterLabel ?? "",
              year: row.semesterYear ?? 0,
            }
          : null,
    }));

    return NextResponse.json(body);
  } catch (err) {
    console.error("speaker-logs GET:", err);
    return NextResponse.json({ error: "Failed to load speaker logs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  // Ensure an event exists for this firm+semester (for 1-year eligibility)
  const existingEvent = await db.query.events.findFirst({
    where: and(
      eq(events.firmId, parsed.data.firmId),
      eq(events.semesterId, parsed.data.semesterId)
    ),
  });
  let eventId = parsed.data.eventId ?? existingEvent?.id ?? null;
  if (!existingEvent) {
    const [newEvent] = await db.insert(events).values({
      firmId: parsed.data.firmId,
      semesterId: parsed.data.semesterId,
      eventDate: parsed.data.logDate,
    }).returning();
    eventId = newEvent?.id ?? null;
  }

  const [row] = await db.insert(speakerLogs).values({
    firmId: parsed.data.firmId,
    semesterId: parsed.data.semesterId,
    eventId,
    logDate: parsed.data.logDate,
    outcome: parsed.data.outcome ?? "confirm",
    thankYouSent: parsed.data.thankYouSent ?? false,
    thankYouSentAt: parsed.data.thankYouSentAt ?? null,
    notes: parsed.data.notes ?? null,
    updatedAt: new Date(),
  }).returning();
  return NextResponse.json(row);
}

export async function PATCH(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const body = await request.json();
  const parsed = createBody.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const set: { outcome?: string; logDate?: string; thankYouSent?: boolean; thankYouSentAt?: string | null; notes?: string | null; updatedAt: Date } = { updatedAt: new Date() };
  if (parsed.data.outcome !== undefined) set.outcome = parsed.data.outcome;
  if (parsed.data.logDate !== undefined) set.logDate = parsed.data.logDate;
  if (parsed.data.notes !== undefined) set.notes = parsed.data.notes;
  if (parsed.data.thankYouSent !== undefined) {
    set.thankYouSent = parsed.data.thankYouSent;
    set.thankYouSentAt = parsed.data.thankYouSent ? (parsed.data.thankYouSentAt ?? new Date().toISOString()) : null;
  }
  const [row] = await db.update(speakerLogs).set(set).where(eq(speakerLogs.id, parseInt(id, 10))).returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.delete(speakerLogs).where(eq(speakerLogs.id, parseInt(id, 10)));
  return NextResponse.json({ ok: true });
}
