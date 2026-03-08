import { NextResponse } from "next/server";
import { db } from "@/db";
import { sendEmail } from "@/lib/email";
import { getTestModeSettings } from "@/lib/test-mode";

/**
 * POST: Send a single test email to the test address in Settings.
 * Use this to verify that email is being delivered to your test inbox.
 */
export async function POST() {
  const { testModeEmail } = await getTestModeSettings(db);
  if (!testModeEmail) {
    console.warn("[send-test-email] No test email set in Settings");
    return NextResponse.json(
      { error: "No test email set. Set a test email address in Settings (Test mode) and save." },
      { status: 400 }
    );
  }

  console.log("[send-test-email] Sending test email to", testModeEmail);
  const result = await sendEmail({
    to: testModeEmail,
    subject: "[NuConnect] Test email",
    html: `
      <p>This is a test email from NuConnect.</p>
      <p>If you received this, your test email is working and is being delivered to this address.</p>
      <p>Invite emails in test mode will also be sent to this address.</p>
    `,
  });

  if (!result.ok) {
    console.error("[send-test-email] Send failed:", result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  console.log("[send-test-email] Success, id:", result.id);
  return NextResponse.json({
    ok: true,
    sentTo: testModeEmail,
    message: `Test email sent to ${testModeEmail}. Check that inbox (and spam).`,
  });
}
