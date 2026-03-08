import { NextResponse } from "next/server";
import { db } from "@/db";
import { events, semesters, firms, invites, speakerLogs } from "@/db/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { isEligibleForSemester, type Term } from "@/lib/eligibility";
import { sendEmail } from "@/lib/email";
import { getInviteTemplate, buildInviteEmail } from "@/lib/invite-email";
import { getTestModeSettings } from "@/lib/test-mode";

/**
 * POST or GET: Send invite emails to all eligible firms for a semester that have NOT been sent yet.
 * Only "new" rows (no existing invite) get an email. Already-sent firms are skipped.
 * POST body: { semesterId?: number }. GET: no body, uses CURRENT_SEMESTER_ID env or latest semester.
 * Optional header: Authorization: Bearer <CRON_SECRET> for cron calls.
 */
function contactDisplay(firm: { contactFirstName: string | null; contactLastName: string | null; contactName: string | null }): string {
  if (firm.contactFirstName || firm.contactLastName) {
    return [firm.contactFirstName, firm.contactLastName].filter(Boolean).join(" ").trim();
  }
  return firm.contactName?.trim() ?? "";
}

async function runBatch(request: Request, method: "GET" | "POST") {
  // When cron calls with Authorization: Bearer <CRON_SECRET>, require it. Manual trigger from UI has no header.
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (cronSecret && auth && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let semesterId: number;
  try {
    const body = method === "POST" ? (await request.json().catch(() => ({}))) : {};
    const id = body?.semesterId ?? process.env.CURRENT_SEMESTER_ID;
    if (id != null) {
      semesterId = typeof id === "string" ? parseInt(id, 10) : id;
    } else {
      const latest = await db.query.semesters.findFirst({
        orderBy: [desc(semesters.year), desc(semesters.term)],
        columns: { id: true },
      });
      if (!latest) {
        return NextResponse.json({ error: "No semesters found. Create a semester first." }, { status: 400 });
      }
      semesterId = latest.id;
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const targetSemester = await db.query.semesters.findFirst({
    where: eq(semesters.id, semesterId),
  });
  if (!targetSemester) {
    return NextResponse.json({ error: "Semester not found" }, { status: 404 });
  }

  const cap = targetSemester.speakerCapacity ?? null;
  if (cap !== null) {
    const [{ value: spokeCount }] = await db
      .select({ value: count() })
      .from(speakerLogs)
      .where(and(eq(speakerLogs.semesterId, semesterId), eq(speakerLogs.outcome, "spoke")));
    const remaining = Math.max(0, cap - spokeCount);
    if (remaining === 0) {
      return NextResponse.json({ error: "This semester is full. Recruitment is closed." }, { status: 400 });
    }
  }

  const allFirms = await db.query.firms.findMany({ orderBy: (f, { asc }) => [asc(f.name)] });
  const sentInvites = await db.query.invites.findMany({
    where: eq(invites.semesterId, semesterId),
  });
  const sentSet = new Set(sentInvites.map((i) => i.firmId));

  const lastEventByFirm = await db
    .select({
      firmId: events.firmId,
      year: semesters.year,
      term: semesters.term,
      label: semesters.label,
    })
    .from(events)
    .innerJoin(semesters, eq(events.semesterId, semesters.id))
    .orderBy(desc(events.createdAt));

  const lastByFirm = new Map<number, { year: number; term: string; label: string }>();
  for (const row of lastEventByFirm) {
    if (!lastByFirm.has(row.firmId)) {
      lastByFirm.set(row.firmId, {
        year: row.year,
        term: row.term,
        label: row.label,
      });
    }
  }

  const targetYear = targetSemester.year;
  const targetTerm = targetSemester.term as Term;

  const pending = allFirms.filter((firm) => {
    if (sentSet.has(firm.id)) return false;
    const last = lastByFirm.get(firm.id);
    return last
      ? isEligibleForSemester(last.year, last.term as Term, targetYear, targetTerm)
      : true;
  });

  const template = await getInviteTemplate(db);
  const { testMode, testModeEmail } = await getTestModeSettings(db);
  let sent = 0;
  let skippedNoEmail = 0;
  const errors: { firmId: number; firmName: string; error: string }[] = [];

  for (const firm of pending) {
    let to: string | null = firm.contactEmail?.trim() ?? null;
    if (!to && !testMode) {
      await db.insert(invites).values({ firmId: firm.id, semesterId });
      skippedNoEmail += 1;
      continue;
    }

    const { subject: rawSubject, html } = buildInviteEmail(template, {
      firmName: firm.name,
      semesterLabel: targetSemester.label,
      contactName: contactDisplay(firm),
    });
    const subject = testMode ? `[TEST] ${rawSubject}` : rawSubject;
    if (testMode && testModeEmail) to = testModeEmail;
    else if (testMode && !to) {
      // Test mode, no firm email: record invite but don't send
      await db.insert(invites).values({ firmId: firm.id, semesterId });
      skippedNoEmail += 1;
      continue;
    }
    if (!to) {
      await db.insert(invites).values({ firmId: firm.id, semesterId });
      skippedNoEmail += 1;
      continue;
    }

    const result = await sendEmail({
      to,
      subject,
      html,
    });

    if (result.ok) {
      await db.insert(invites).values({
        firmId: firm.id,
        semesterId,
        emailId: result.id ?? null,
      });
      sent += 1;
    } else {
      errors.push({ firmId: firm.id, firmName: firm.name, error: result.error });
    }
  }

  return NextResponse.json({
    ok: true,
    semesterId,
    semesterLabel: targetSemester.label,
    sent,
    skippedNoEmail,
    ...(testMode && { testMode: true }),
    errors: errors.length ? errors : undefined,
  });
}

export async function POST(request: Request) {
  return runBatch(request, "POST");
}

export async function GET(request: Request) {
  return runBatch(request, "GET");
}
