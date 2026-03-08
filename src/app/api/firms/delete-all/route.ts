import { NextResponse } from "next/server";
import { db } from "@/db";
import { firms, invites, events, speakerLogs, schedulingSubmissions } from "@/db/schema";

/** POST /api/firms/delete-all — deletes all firms and related data. No body required. */
export async function POST() {
  try {
    await db.delete(schedulingSubmissions);
    await db.delete(invites);
    await db.delete(speakerLogs);
    await db.delete(events);
    await db.delete(firms);
    return NextResponse.json({ ok: true, deleted: "all" });
  } catch (err) {
    console.error("firms delete-all:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete all firms" },
      { status: 500 }
    );
  }
}
