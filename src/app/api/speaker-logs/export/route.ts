import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/db";
import { speakerLogs } from "@/db/schema";
import { eq } from "drizzle-orm";

const OUTCOME_LABELS: Record<string, string> = {
  confirm: "Confirmed",
  spoke: "Spoke",
  cancel: "Canceled",
  rescheduled: "Rescheduled",
};

function speakerName(firm: { contactFirstName?: string | null; contactLastName?: string | null; contactName?: string | null }): string {
  if (firm.contactFirstName || firm.contactLastName) {
    return [firm.contactFirstName, firm.contactLastName].filter(Boolean).join(" ").trim() || "";
  }
  return firm.contactName ?? "";
}

export async function GET(request: NextRequest) {
  try {
    const firmId = request.nextUrl.searchParams.get("firmId");
    const semesterId = request.nextUrl.searchParams.get("semesterId");
    let list;
    if (firmId) {
      list = await db.query.speakerLogs.findMany({
        where: eq(speakerLogs.firmId, parseInt(firmId, 10)),
        with: { firm: true, semester: true },
      });
    } else if (semesterId) {
      list = await db.query.speakerLogs.findMany({
        where: eq(speakerLogs.semesterId, parseInt(semesterId, 10)),
        with: { firm: true, semester: true },
      });
    } else {
      list = await db.query.speakerLogs.findMany({
        with: { firm: true, semester: true },
      });
    }

    const headers = [
      "Firm name",
      "Organization",
      "Session type",
      "Topic",
      "Event date",
      "Academic year",
      "Semester",
      "School",
      "Speaker name",
      "Outcome",
    ];
    const rows = list.map((log) => [
      log.firm?.name ?? "",
      log.firm?.name ?? "",
      "",
      "",
      log.logDate ?? "",
      log.semester?.year ?? "",
      log.semester?.label ?? "",
      "",
      speakerName(log.firm ?? {}),
      OUTCOME_LABELS[log.outcome ?? ""] ?? (log.outcome ?? ""),
    ]);
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Speaker log");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = "speaker-log.xlsx";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("speaker-logs export:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
