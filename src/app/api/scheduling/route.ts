import { NextResponse } from "next/server";
import { db } from "@/db";
import { schedulingSubmissions } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const list = await db.query.schedulingSubmissions.findMany({
      orderBy: [desc(schedulingSubmissions.createdAt)],
      with: {
        firm: true,
        semester: true,
      },
    });
    return NextResponse.json(list);
  } catch (err) {
    console.error("scheduling GET:", err);
    return NextResponse.json([], { status: 200 });
  }
}
