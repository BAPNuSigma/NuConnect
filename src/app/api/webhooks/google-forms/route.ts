import { NextResponse } from "next/server";
import { db } from "@/db";
import { schedulingSubmissions, firms, semesters } from "@/db/schema";
import { like } from "drizzle-orm";

/**
 * POST: receive Google Forms submission.
 * Configure in Google Forms via Apps Script: send a POST to this URL with JSON body.
 * Body shape (customize to match your form): { firmName?, firmEmail?, semesterLabel?, ...rest }
 * We store raw payload and optionally link to firm/semester by name.
 */
const secret = process.env.GOOGLE_FORMS_WEBHOOK_SECRET;

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

  const firmName = typeof body.firmName === "string" ? body.firmName : (body.company ?? body.firm) as string | undefined;
  const semesterLabel = typeof body.semester === "string" ? body.semester : (body.semesterLabel as string | undefined);

  let firmId: number | null = null;
  let semesterId: number | null = null;

  if (firmName) {
    const match = await db.query.firms.findFirst({
      where: like(firms.name, `%${firmName}%`),
      columns: { id: true },
    });
    if (match) firmId = match.id;
  }
  if (semesterLabel) {
    const match = await db.query.semesters.findFirst({
      where: like(semesters.label, `%${semesterLabel}%`),
      columns: { id: true },
    });
    if (match) semesterId = match.id;
  }

  const [row] = await db.insert(schedulingSubmissions).values({
    firmId,
    firmName: firmName ?? null,
    semesterId,
    submittedAt: new Date().toISOString(),
    rawPayload: JSON.stringify(body),
  }).returning();

  return NextResponse.json({ ok: true, id: row?.id });
}

export async function GET() {
  return NextResponse.json({
    message: "POST form submissions here. Set GOOGLE_FORMS_WEBHOOK_SECRET for auth.",
  });
}
