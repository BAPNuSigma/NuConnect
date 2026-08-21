import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchContactInfo } from "@/lib/leadSearch";

const enrichInput = z.object({ url: z.string().url() });

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = enrichInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid url" }, { status: 400 });
  }

  const result = await fetchContactInfo(parsed.data.url);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ emails: result.emails, phones: result.phones });
}
