import { NextResponse } from "next/server";
import { db } from "@/db";
import { firms, semesters, invites, speakerLogs } from "@/db/schema";
import { eq, and, count, desc, asc } from "drizzle-orm";
import { isEligibleForSemester, type Term } from "@/lib/eligibility";
import { sendEmail } from "@/lib/email";
import { getInviteTemplate, buildInviteEmail } from "@/lib/invite-email";
import { getTestModeSettings } from "@/lib/test-mode";
import { z } from "zod";

const bodySchema = z.object({
  firmId: z.number().int(),
  semesterId: z.number().int(),
});

function contactDisplay(firm: { contactFirstName: string | null; contactLastName: string | null; contactName: string | null }): string {
  if (firm.contactFirstName || firm.contactLastName) {
    return [firm.contactFirstName, firm.contactLastName].filter(Boolean).join(" ").trim();
  }
  return firm.contactName?.trim() ?? "";
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { firmId, semesterId } = parsed.data;

  const [firm, semester] = await Promise.all([
    db.query.firms.findFirst({ where: eq(firms.id, firmId) }),
    db.query.semesters.findFirst({ where: eq(semesters.id, semesterId) }),
  ]);
  if (!firm || !semester) {
    return NextResponse.json({ error: "Firm or semester not found" }, { status: 404 });
  }

  const cap = semester.speakerCapacity ?? null;
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

  const existing = await db.query.invites.findFirst({
    where: and(eq(invites.firmId, firmId), eq(invites.semesterId, semesterId)),
  });
  if (existing) {
    return NextResponse.json({ error: "Invite already sent for this firm/semester" }, { status: 409 });
  }

  // Enforce 1-year rule: do not send to firms that spoke within the last year (same as batch + Invites page)
  const lastSpokeRow = await db
    .select({ year: semesters.year, term: semesters.term })
    .from(speakerLogs)
    .innerJoin(semesters, eq(speakerLogs.semesterId, semesters.id))
    .where(and(eq(speakerLogs.firmId, firmId), eq(speakerLogs.outcome, "spoke")))
    .orderBy(desc(semesters.year), asc(semesters.term))
    .limit(1)
    .then((rows) => rows[0]);
  if (lastSpokeRow) {
    const eligible = isEligibleForSemester(
      lastSpokeRow.year,
      lastSpokeRow.term as Term,
      semester.year,
      semester.term as Term
    );
    if (!eligible) {
      return NextResponse.json(
        {
          error:
            "Firm is not eligible under the 1-year rule (they spoke recently). They become eligible again for the same semester next year.",
        },
        { status: 400 }
      );
    }
  }

  const template = await getInviteTemplate(db);
  const { subject: rawSubject, html } = buildInviteEmail(template, {
    firmName: firm.name,
    semesterLabel: semester.label,
    contactName: contactDisplay(firm),
  });

  const { testMode, testModeEmail } = await getTestModeSettings(db);
  let to: string | undefined = firm.contactEmail ?? undefined;
  let subject = rawSubject;
  let skipSend = false;

  if (testMode) {
    subject = `[TEST] ${rawSubject}`;
    if (testModeEmail) {
      to = testModeEmail; // Send to test address instead of firm
    } else {
      skipSend = true; // No test address: record invite but don't send
    }
  }

  if (!to || skipSend) {
    const [inv] = await db.insert(invites).values({ firmId, semesterId }).returning();
    return NextResponse.json({
      ok: true,
      invite: inv,
      sent: false,
      message: skipSend
        ? "Test mode: email not sent (set a test address in Settings to receive test emails)."
        : "No contact email for firm; invite recorded only.",
    });
  }

  const result = await sendEmail({
    to,
    subject,
    html,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const [inv] = await db.insert(invites).values({
    firmId,
    semesterId,
    emailId: result.id ?? null,
  }).returning();

  return NextResponse.json({
    ok: true,
    invite: inv,
    sent: true,
    emailId: result.id,
    ...(testMode && { testMode: true, sentTo: to }),
  });
}
