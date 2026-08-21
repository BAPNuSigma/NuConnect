import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { isLeadSearchConfigured, normalizeFirmName, searchBusinesses } from "@/lib/leadSearch";

const searchInput = z.object({
  discipline: z.string().optional(),
  location: z.string().optional(),
  firmType: z.string().optional(),
});

export async function POST(request: Request) {
  if (!isLeadSearchConfigured()) {
    return NextResponse.json(
      { error: "Lead search isn't configured. Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID in your environment." },
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

  const result = await searchBusinesses({ discipline, location, firmType });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

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

  return NextResponse.json({ query: result.query, results });
}
