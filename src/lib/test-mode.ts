import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const TEST_MODE_KEY = "test_mode";
const TEST_MODE_EMAIL_KEY = "test_mode_email";

/** Returns test mode and optional test email. Use in API routes that send email. */
export async function getTestModeSettings(dbInstance: typeof db): Promise<{ testMode: boolean; testModeEmail: string | null }> {
  const [modeRow, emailRow] = await Promise.all([
    dbInstance.query.appSettings.findFirst({ where: eq(appSettings.key, TEST_MODE_KEY), columns: { value: true } }),
    dbInstance.query.appSettings.findFirst({ where: eq(appSettings.key, TEST_MODE_EMAIL_KEY), columns: { value: true } }),
  ]);
  return {
    testMode: modeRow?.value === "true",
    testModeEmail: (emailRow?.value ?? "").trim() || null,
  };
}
