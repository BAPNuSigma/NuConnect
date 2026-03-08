import { NextResponse } from "next/server";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OPEN_SEMESTER_KEY = "open_semester_id";
const INVITE_EMAIL_SUBJECT_KEY = "invite_email_subject";
const INVITE_EMAIL_BODY_KEY = "invite_email_body";
const INVITE_EMAIL_YOUR_NAME_KEY = "invite_email_your_name";
const INVITE_EMAIL_EBOARD_POSITION_KEY = "invite_email_eboard_position";
const INVITE_EMAIL_SCHEDULING_LINK_KEY = "invite_email_scheduling_link";
const INVITE_EMAIL_SIGNATURE_ENABLED_KEY = "invite_email_signature_enabled";
const TEST_MODE_KEY = "test_mode";
const TEST_MODE_EMAIL_KEY = "test_mode_email";

export async function GET() {
  try {
    const [openRow, subjectRow, bodyRow, yourNameRow, eBoardRow, linkRow, signatureRow, testModeRow, testModeEmailRow] = await Promise.all([
      db.query.appSettings.findFirst({ where: eq(appSettings.key, OPEN_SEMESTER_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_SUBJECT_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_BODY_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_YOUR_NAME_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_EBOARD_POSITION_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_SCHEDULING_LINK_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_SIGNATURE_ENABLED_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, TEST_MODE_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, TEST_MODE_EMAIL_KEY), columns: { value: true } }),
    ]);
    const openVal = openRow?.value;
    const openSemesterId = openVal != null ? parseInt(openVal, 10) : null;
    const testMode = testModeRow?.value === "true";
    const inviteEmailSignatureEnabled = signatureRow?.value === "true";
    return NextResponse.json({
      openSemesterId: Number.isNaN(openSemesterId) ? null : openSemesterId,
      inviteEmailSubject: subjectRow?.value ?? "",
      inviteEmailBody: bodyRow?.value ?? "",
      inviteEmailYourName: yourNameRow?.value ?? "",
      inviteEmailEBoardPosition: eBoardRow?.value ?? "",
      inviteEmailSchedulingLink: linkRow?.value ?? "",
      inviteEmailSignatureEnabled,
      testMode,
      testModeEmail: testModeEmailRow?.value ?? "",
    });
  } catch (err) {
    console.error("settings GET:", err);
    return NextResponse.json({
      openSemesterId: null,
      inviteEmailSubject: "",
      inviteEmailBody: "",
      inviteEmailYourName: "",
      inviteEmailEBoardPosition: "",
      inviteEmailSchedulingLink: "",
      inviteEmailSignatureEnabled: false,
      testMode: false,
      testModeEmail: "",
    });
  }
}

async function setSetting(key: string, value: string | null) {
  await db.delete(appSettings).where(eq(appSettings.key, key));
  if (value != null && value !== "") {
    await db.insert(appSettings).values({ key, value });
  }
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // empty or invalid JSON body
  }
  if (typeof body !== "object" || body === null) body = {};
  try {
    if (body.openSemesterId !== undefined) {
      const openSemesterId =
        body.openSemesterId != null ? Number(body.openSemesterId) : null;
      await setSetting(OPEN_SEMESTER_KEY, openSemesterId != null ? String(openSemesterId) : null);
    }
    if (body.inviteEmailSubject !== undefined) {
      await setSetting(INVITE_EMAIL_SUBJECT_KEY, String(body.inviteEmailSubject));
    }
    if (body.inviteEmailBody !== undefined) {
      await setSetting(INVITE_EMAIL_BODY_KEY, String(body.inviteEmailBody));
    }
    if (body.inviteEmailYourName !== undefined) {
      await setSetting(INVITE_EMAIL_YOUR_NAME_KEY, String(body.inviteEmailYourName));
    }
    if (body.inviteEmailEBoardPosition !== undefined) {
      await setSetting(INVITE_EMAIL_EBOARD_POSITION_KEY, String(body.inviteEmailEBoardPosition));
    }
    if (body.inviteEmailSchedulingLink !== undefined) {
      await setSetting(INVITE_EMAIL_SCHEDULING_LINK_KEY, String(body.inviteEmailSchedulingLink));
    }
    if (body.inviteEmailSignatureEnabled !== undefined) {
      await setSetting(INVITE_EMAIL_SIGNATURE_ENABLED_KEY, body.inviteEmailSignatureEnabled ? "true" : "false");
    }
    if (body.testMode !== undefined) {
      await setSetting(TEST_MODE_KEY, body.testMode ? "true" : "false");
    }
    if (body.testModeEmail !== undefined) {
      await setSetting(TEST_MODE_EMAIL_KEY, String(body.testModeEmail).trim() || null);
    }
    // Return current state
    const [openRow, subjectRow, bodyRow, yourNameRow, eBoardRow, linkRow, signatureRow, testModeRow, testModeEmailRow] = await Promise.all([
      db.query.appSettings.findFirst({ where: eq(appSettings.key, OPEN_SEMESTER_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_SUBJECT_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_BODY_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_YOUR_NAME_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_EBOARD_POSITION_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_SCHEDULING_LINK_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_SIGNATURE_ENABLED_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, TEST_MODE_KEY), columns: { value: true } }),
      db.query.appSettings.findFirst({ where: eq(appSettings.key, TEST_MODE_EMAIL_KEY), columns: { value: true } }),
    ]);
    const openVal = openRow?.value;
    const openSemesterId = openVal != null ? parseInt(openVal, 10) : null;
    const testMode = testModeRow?.value === "true";
    const inviteEmailSignatureEnabled = signatureRow?.value === "true";
    return NextResponse.json({
      openSemesterId: Number.isNaN(openSemesterId) ? null : openSemesterId,
      inviteEmailSubject: subjectRow?.value ?? "",
      inviteEmailBody: bodyRow?.value ?? "",
      inviteEmailYourName: yourNameRow?.value ?? "",
      inviteEmailEBoardPosition: eBoardRow?.value ?? "",
      inviteEmailSchedulingLink: linkRow?.value ?? "",
      inviteEmailSignatureEnabled,
      testMode,
      testModeEmail: testModeEmailRow?.value ?? "",
    });
  } catch (err) {
    console.error("settings PATCH:", err);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
