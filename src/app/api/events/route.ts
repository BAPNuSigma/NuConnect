import { NextResponse } from "next/server";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const createBody = z.object({
  firmId: z.number().int(),
  semesterId: z.number().int(),
  eventDate: z.string().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const firmId = url.searchParams.get("firmId");
  const semesterId = url.searchParams.get("semesterId");
  let list;
  if (firmId) {
    list = await db.query.events.findMany({
      where: eq(events.firmId, parseInt(firmId, 10)),
      with: { semester: true },
    });
  } else if (semesterId) {
    list = await db.query.events.findMany({
      where: eq(events.semesterId, parseInt(semesterId, 10)),
      with: { firm: true },
    });
  } else {
    list = await db.query.events.findMany({
      with: { firm: true, semester: true },
    });
  }
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const [row] = await db.insert(events).values({
    firmId: parsed.data.firmId,
    semesterId: parsed.data.semesterId,
    eventDate: parsed.data.eventDate ?? null,
  }).returning();
  return NextResponse.json(row);
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.delete(events).where(eq(events.id, parseInt(id, 10)));
  return NextResponse.json({ ok: true });
}
