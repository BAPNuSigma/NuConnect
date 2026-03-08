import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const TEST_MODE_KEY = "test_mode";
const TEST_MODE_EMAIL_KEY = "test_mode_email";

type Db = { query: { appSettings: { findFirst: (args: { where: unknown; columns: { value: true } }) => Promise<{ value: string } | undefined> } } };

/** Returns test mode and optional test email. Use in API routes that send email. */
export async function getTestModeSettings(db: Db): Promise<{ testMode: boolean; testModeEmail: string | null }> {
  const [modeRow, emailRow] = await Promise.all([
    db.query.appSettings.findFirst({ where: eq(appSettings.key, TEST_MODE_KEY), columns: { value: true } }),
    db.query.appSettings.findFirst({ where: eq(appSettings.key, TEST_MODE_EMAIL_KEY), columns: { value: true } }),
  ]);
  return {
    testMode: modeRow?.value === "true",
    testModeEmail: (emailRow?.value ?? "").trim() || null,
  };
}
