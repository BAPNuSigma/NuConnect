import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { firms, invites, semesters, speakerLogs, schedulingSubmissions } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { z } from "zod";

const firmFields = z.object({
  name: z.string().min(1),
  discipline: z.string().optional(),
  contactFirstName: z.string().optional(),
  contactLastName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactName: z.string().optional(),
  title: z.string().optional(),
  practiceArea: z.string().optional(),
  firmType: z.string().optional(),
  industryFocus: z.string().optional(),
  location: z.string().optional(),
  alumniConnection: z.string().optional(),
  personalizedNote: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const list = await db.query.firms.findMany({ orderBy: (f, { asc }) => [asc(f.name)] });

    const [inviteRows, spokeRows] = await Promise.all([
    db.select({
      firmId: invites.firmId,
      year: semesters.year,
      label: semesters.label,
    })
      .from(invites)
      .innerJoin(semesters, eq(invites.semesterId, semesters.id))
      .orderBy(desc(invites.sentAt)),
    // Last spoke from speaker_logs (outcome = 'spoke') so Firms page matches Speaker logs page
    db.select({
      firmId: speakerLogs.firmId,
      year: semesters.year,
      label: semesters.label,
    })
      .from(speakerLogs)
      .innerJoin(semesters, eq(speakerLogs.semesterId, semesters.id))
      .where(eq(speakerLogs.outcome, "spoke"))
      .orderBy(desc(semesters.year), asc(semesters.term)), // Fall after Spring for same year = latest first
  ]);

  const lastInvitedByFirmId = new Map<number, { year: number; label: string }>();
  for (const row of inviteRows) {
    if (!lastInvitedByFirmId.has(row.firmId)) {
      lastInvitedByFirmId.set(row.firmId, { year: row.year, label: row.label });
    }
  }
  const lastSpokeByFirmId = new Map<number, { year: number; label: string }>();
  for (const row of spokeRows) {
    if (!lastSpokeByFirmId.has(row.firmId)) {
      lastSpokeByFirmId.set(row.firmId, { year: row.year, label: row.label });
    }
  }

  /** Prefer later semester: Fall > Spring for same year. */
  function isNewer(
    a: { year: number; label: string } | undefined,
    b: { year: number; label: string } | undefined
  ): boolean {
    if (!a) return false;
    if (!b) return true;
    if (a.year !== b.year) return a.year > b.year;
    return a.label.toLowerCase() === "fall" && b.label.toLowerCase() !== "fall";
  }

  /** Per firm name: show same last invited / last spoke for all contacts (e.g. Withem). */
  const lastInvitedByFirmName = new Map<string, { year: number; label: string }>();
  const lastSpokeByFirmName = new Map<string, { year: number; label: string }>();
  for (const f of list) {
    const nameKey = (f.name ?? "").trim() || String(f.id);
    const inv = lastInvitedByFirmId.get(f.id);
    const sp = lastSpokeByFirmId.get(f.id);
    if (inv && isNewer(inv, lastInvitedByFirmName.get(nameKey))) {
      lastInvitedByFirmName.set(nameKey, inv);
    }
    if (sp && isNewer(sp, lastSpokeByFirmName.get(nameKey))) {
      lastSpokeByFirmName.set(nameKey, sp);
    }
  }

  const result = list.map((f) => {
    const nameKey = (f.name ?? "").trim() || String(f.id);
    return {
      ...f,
      lastAcademicYearInvited: lastInvitedByFirmName.get(nameKey)?.year ?? null,
      lastAcademicYearSpoke: lastSpokeByFirmName.get(nameKey)?.year ?? null,
      lastSemesterSpoke: lastSpokeByFirmName.get(nameKey)?.label ?? null,
    };
  });

    return NextResponse.json(result);
  } catch (err) {
    console.error("firms GET:", err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = firmFields.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const [row] = await db.insert(firms).values({
    name: d.name,
    discipline: d.discipline || null,
    contactFirstName: d.contactFirstName || null,
    contactLastName: d.contactLastName || null,
    contactEmail: d.contactEmail || null,
    contactName: d.contactName || null,
    title: d.title || null,
    practiceArea: d.practiceArea || null,
    firmType: d.firmType || null,
    industryFocus: d.industryFocus || null,
    location: d.location || null,
    alumniConnection: d.alumniConnection || null,
    personalizedNote: d.personalizedNote || null,
    notes: d.notes || null,
    updatedAt: new Date(),
  }).returning();
  return NextResponse.json(row);
}

export async function PATCH(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const body = await request.json();
  const parsed = firmFields.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const [row] = await db.update(firms).set({
    ...(d.name !== undefined && { name: d.name }),
    ...(d.discipline !== undefined && { discipline: d.discipline || null }),
    ...(d.contactFirstName !== undefined && { contactFirstName: d.contactFirstName || null }),
    ...(d.contactLastName !== undefined && { contactLastName: d.contactLastName || null }),
    ...(d.contactEmail !== undefined && { contactEmail: d.contactEmail || null }),
    ...(d.contactName !== undefined && { contactName: d.contactName || null }),
    ...(d.title !== undefined && { title: d.title || null }),
    ...(d.practiceArea !== undefined && { practiceArea: d.practiceArea || null }),
    ...(d.firmType !== undefined && { firmType: d.firmType || null }),
    ...(d.industryFocus !== undefined && { industryFocus: d.industryFocus || null }),
    ...(d.location !== undefined && { location: d.location || null }),
    ...(d.alumniConnection !== undefined && { alumniConnection: d.alumniConnection || null }),
    ...(d.personalizedNote !== undefined && { personalizedNote: d.personalizedNote || null }),
    ...(d.notes !== undefined && { notes: d.notes || null }),
    updatedAt: new Date(),
  }).where(eq(firms.id, parseInt(id, 10))).returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(request: NextRequest) {
  const all = request.nextUrl.searchParams.get("all") === "true";
  const id = request.nextUrl.searchParams.get("id");
  if (all) {
    try {
      // Delete in dependency order so SQLite FK (if enabled) doesn't block
      await db.delete(schedulingSubmissions);
      await db.delete(invites);
      await db.delete(speakerLogs);
      await db.delete(events);
      await db.delete(firms);
      return NextResponse.json({ ok: true, deleted: "all" });
    } catch (err) {
      console.error("firms DELETE all:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to delete all firms" },
        { status: 500 }
      );
    }
  }
  if (!id) return NextResponse.json({ error: "Missing id or ?all=true" }, { status: 400 });
  await db.delete(firms).where(eq(firms.id, parseInt(id, 10)));
  return NextResponse.json({ ok: true });
}
