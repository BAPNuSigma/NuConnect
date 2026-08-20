import { NextResponse } from "next/server";
import { db } from "@/db";
import { schedulingSubmissions, speakerLogs, events, firms, semesters, invites } from "@/db/schema";
import { and, asc, eq, like, sql } from "drizzle-orm";

/**
 * POST: receive Google Forms submission.
 * Configure in Google Forms via Apps Script: send a POST to this URL with JSON body.
 * Body shape (customize to match your form): { firmName?, firmEmail?, semesterLabel?, ...rest }
 * We store raw payload and optionally link to firm/semester by name.
 */
const secret = process.env.GOOGLE_FORMS_WEBHOOK_SECRET;

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function responseNotes(body: Record<string, unknown>): string | null {
  const ignored = new Set(["firmName", "company", "firm", "semester", "semesterLabel", "preferredDate"]);
  const lines = Object.entries(body)
    .filter(([key, value]) => !ignored.has(key) && value != null && String(value).trim())
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`);
  return lines.length ? lines.join("\n") : null;
}

function responseDate(value: unknown, fallback: string): string {
  const raw = stringValue(value);
  if (!raw) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const firmName = stringValue(body.firmName) ?? stringValue(body.company) ?? stringValue(body.firm);
  const firmEmail = stringValue(body.primaryContactEmail) ?? stringValue(body.firmEmail) ?? stringValue(body.email);
  const semesterLabel = stringValue(body.semester) ?? stringValue(body.semesterLabel);

  let firmId: number | null = null;
  let semesterId: number | null = null;

  if (firmEmail) {
    const emailMatch = await db.query.firms.findFirst({
      where: sql`lower(trim(${firms.contactEmail})) = lower(${firmEmail})`,
      columns: { id: true },
      orderBy: [asc(firms.id)],
    });
    if (emailMatch) firmId = emailMatch.id;
  }
  if (firmId === null && firmName) {
    const match = await db.query.firms.findFirst({
      where: sql`lower(trim(${firms.name})) = lower(${firmName})`,
      columns: { id: true },
      orderBy: [asc(firms.id)],
    });
    const fallback = match ?? await db.query.firms.findFirst({
      where: like(firms.name, `%${firmName}%`),
      columns: { id: true },
      orderBy: [asc(firms.id)],
    });
    if (fallback) firmId = fallback.id;
  }
  if (semesterLabel) {
    const match = await db.query.semesters.findFirst({
      where: sql`lower(trim(${semesters.label})) = lower(${semesterLabel})`,
      columns: { id: true },
    });
    if (match) semesterId = match.id;
  }

  const submittedAt = new Date().toISOString();
  const logDate = responseDate(body.preferredDate, submittedAt.slice(0, 10));
  const notes = responseNotes(body);

  const result = await db.transaction(async (tx) => {
    const [submission] = await tx.insert(schedulingSubmissions).values({
      firmId,
      firmName: firmName ?? null,
      semesterId,
      submittedAt,
      rawPayload: JSON.stringify(body),
    }).returning();

    let speakerLogId: number | null = null;
    let inviteUpdated = false;
    if (firmId !== null && semesterId !== null) {
      const updatedInvites = await tx.update(invites).set({
        inByStatus: "scheduled",
        replied: true,
      }).where(and(eq(invites.firmId, firmId), eq(invites.semesterId, semesterId))).returning({ id: invites.id });
      inviteUpdated = updatedInvites.length > 0;

      let event = await tx.query.events.findFirst({
        where: and(eq(events.firmId, firmId), eq(events.semesterId, semesterId)),
      });
      if (!event) {
        [event] = await tx.insert(events).values({ firmId, semesterId, eventDate: logDate }).returning();
      } else if (logDate && event.eventDate !== logDate) {
        [event] = await tx.update(events).set({ eventDate: logDate }).where(eq(events.id, event.id)).returning();
      }

      const existing = await tx.query.speakerLogs.findFirst({
        where: and(eq(speakerLogs.firmId, firmId), eq(speakerLogs.semesterId, semesterId)),
        orderBy: [asc(speakerLogs.id)],
      });
      if (existing) {
        const [updated] = await tx.update(speakerLogs).set({
          eventId: event?.id ?? existing.eventId,
          logDate,
          notes,
          updatedAt: new Date(),
        }).where(eq(speakerLogs.id, existing.id)).returning();
        speakerLogId = updated?.id ?? existing.id;
      } else {
        const [created] = await tx.insert(speakerLogs).values({
          firmId,
          semesterId,
          eventId: event?.id ?? null,
          logDate,
          outcome: "confirm",
          notes,
          updatedAt: new Date(),
        }).returning();
        speakerLogId = created?.id ?? null;
      }
    }

    return { submissionId: submission?.id, speakerLogId, inviteUpdated };
  });

  return NextResponse.json({ ok: true, id: result.submissionId, speakerLogId: result.speakerLogId, inviteUpdated: result.inviteUpdated });
}

export async function GET() {
  return NextResponse.json({
    message: "POST form submissions here. Set GOOGLE_FORMS_WEBHOOK_SECRET for auth.",
  });
}
