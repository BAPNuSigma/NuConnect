import { NextResponse } from "next/server";
import { db } from "@/db";
import { speakerLogs } from "@/db/schema";

/** POST /api/speaker-logs/delete-all — deletes all speaker log entries. */
export async function POST() {
  try {
    await db.delete(speakerLogs);
    return NextResponse.json({ ok: true, deleted: "all" });
  } catch (err) {
    console.error("speaker-logs delete-all:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete all speaker logs" },
      { status: 500 }
    );
  }
}
