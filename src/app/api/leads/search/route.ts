import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { braveMonthlyCap, isBraveSearchConfigured, isLeadSearchConfigured, normalizeFirmName, searchBusinesses } from "@/lib/leadSearch";

const searchInput = z.object({
  discipline: z.string().optional(),
  location: z.string().optional(),
  firmType: z.string().optional(),
});

// Brave has no built-in spending cap once its $5/month free credit runs out, so this app
// tracks its own usage count per calendar month and stops calling Brave past the cap.
const BRAVE_USAGE_KEY = "brave_search_usage_month";

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getBraveUsage(): Promise<number> {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, BRAVE_USAGE_KEY), columns: { value: true } });
  if (!row) return 0;
  try {
    const parsed = JSON.parse(row.value) as { yearMonth: string; count: number };
    return parsed.yearMonth === currentYearMonth() ? parsed.count : 0;
  } catch {
    return 0;
  }
}

async function recordBraveUsage(previousCount: number): Promise<void> {
  const value = JSON.stringify({ yearMonth: currentYearMonth(), count: previousCount + 1 });
  await db.delete(appSettings).where(eq(appSettings.key, BRAVE_USAGE_KEY));
  await db.insert(appSettings).values({ key: BRAVE_USAGE_KEY, value });
}

export async function POST(request: Request) {
  if (!isLeadSearchConfigured()) {
    return NextResponse.json(
      { error: "Lead search isn't configured. Set GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID, and/or BRAVE_API_KEY." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = searchInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search input" }, { status: 400 });
  }
  const { discipline, location, firmType } = parsed.data;
  if (!discipline && !location && !firmType) {
    return NextResponse.json({ error: "Enter at least a discipline, location, or firm type." }, { status: 400 });
  }

  const braveConfigured = isBraveSearchConfigured();
  const braveCap = braveMonthlyCap();
  const braveUsageBefore = braveConfigured ? await getBraveUsage() : 0;
  const braveOverBudget = braveConfigured && braveUsageBefore >= braveCap;

  const result = await searchBusinesses({ discipline, location, firmType }, { useBrave: !braveOverBudget });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const braveUsedThisCall = braveConfigured && !braveOverBudget;
  if (braveUsedThisCall) await recordBraveUsage(braveUsageBefore);

  const existingFirms = await db.query.firms.findMany({ columns: { name: true } });
  const existingNormalized = existingFirms.map((f) => normalizeFirmName(f.name));

  const results = result.results.map((candidate) => {
    const normalized = normalizeFirmName(candidate.name);
    const tracked = existingNormalized.some(
      (existing) =>
        existing.length > 0 &&
        normalized.length > 0 &&
        (existing === normalized ||
          (normalized.length >= 4 && (existing.includes(normalized) || normalized.includes(existing))))
    );
    return { ...candidate, status: tracked ? ("tracked" as const) : ("new" as const) };
  });

  return NextResponse.json({
    query: result.query,
    results,
    brave: braveConfigured
      ? { used: braveUsedThisCall ? braveUsageBefore + 1 : braveUsageBefore, cap: braveCap, paused: braveOverBudget }
      : null,
  });
}
