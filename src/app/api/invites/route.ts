import { NextResponse } from "next/server";
import { db } from "@/db";
import { invites, firms, semesters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const sendBody = z.object({
  firmId: z.number().int(),
  semesterId: z.number().int(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const semesterId = url.searchParams.get("semesterId");
  let query = db
    .select({
      id: invites.id,
      firmId: invites.firmId,
      semesterId: invites.semesterId,
      sentAt: invites.sentAt,
      inByStatus: invites.inByStatus,
      followUpDate: invites.followUpDate,
      replied: invites.replied,
      firmId_firm: firms.id,
      firmName: firms.name,
      firmContactEmail: firms.contactEmail,
      semesterId_sem: semesters.id,
      semesterLabel: semesters.label,
    })
    .from(invites)
    .leftJoin(firms, eq(invites.firmId, firms.id))
    .leftJoin(semesters, eq(invites.semesterId, semesters.id));
  if (semesterId) {
    query = query.where(eq(invites.semesterId, parseInt(semesterId, 10))) as typeof query;
  }
  const rows = await query;
  const list = rows.map((row) => ({
    id: row.id,
    firmId: row.firmId,
    semesterId: row.semesterId,
    sentAt: row.sentAt,
    inByStatus: row.inByStatus ?? null,
    followUpDate: row.followUpDate ?? null,
    replied: row.replied ?? false,
    firm:
      row.firmId_firm != null
        ? { id: row.firmId_firm, name: row.firmName ?? "", contactEmail: row.firmContactEmail ?? null }
        : null,
    semester:
      row.semesterId_sem != null
        ? { id: row.semesterId_sem, label: row.semesterLabel ?? "" }
        : null,
  }));
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = sendBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const existing = await db.query.invites.findFirst({
    where: and(
      eq(invites.firmId, parsed.data.firmId),
      eq(invites.semesterId, parsed.data.semesterId)
    ),
  });
  if (existing) {
    return NextResponse.json({ error: "Invite already sent for this firm/semester" }, { status: 409 });
  }
  const [row] = await db.insert(invites).values({
    firmId: parsed.data.firmId,
    semesterId: parsed.data.semesterId,
  }).returning();
  return NextResponse.json(row);
}

const patchBody = z.object({
  inByStatus: z.string().optional(),
  followUpDate: z.string().optional(),
  replied: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const body = await request.json();
  const parsed = patchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const [row] = await db.update(invites).set({
    ...(parsed.data.inByStatus !== undefined && { inByStatus: parsed.data.inByStatus || null }),
    ...(parsed.data.followUpDate !== undefined && { followUpDate: parsed.data.followUpDate || null }),
    ...(parsed.data.replied !== undefined && { replied: parsed.data.replied }),
  }).where(eq(invites.id, parseInt(id, 10))).returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.delete(invites).where(eq(invites.id, parseInt(id, 10)));
  return NextResponse.json({ ok: true });
}
