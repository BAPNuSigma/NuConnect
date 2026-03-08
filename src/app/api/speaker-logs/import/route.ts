import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/db";
import { speakerLogs, events, firms, semesters } from "@/db/schema";
import { eq, and } from "drizzle-orm";

function findCol(headers: string[], keywords: string[]): number {
  for (let c = 0; c < headers.length; c++) {
    const h = (headers[c] ?? "").toString().trim().toLowerCase();
    for (const kw of keywords) {
      if (h.includes(kw)) return c;
    }
  }
  return -1;
}

function safeStr(val: unknown): string {
  if (val == null) return "";
  const s = String(val).trim();
  return s === "" || s.toLowerCase() === "n/a" ? "" : s;
}

function getCell(row: unknown[], col: number): unknown {
  if (col < 0 || col >= row.length) return undefined;
  return row[col];
}

const OUTCOME_MAP: Record<string, "confirm" | "spoke" | "cancel" | "rescheduled"> = {
  confirm: "confirm",
  confirmed: "confirm",
  spoke: "spoke",
  cancel: "cancel",
  canceled: "cancel",
  cancelled: "cancel",
  reschedule: "rescheduled",
  rescheduled: "rescheduled",
};

function parseOutcome(val: string): "confirm" | "spoke" | "cancel" | "rescheduled" {
  const key = val.trim().toLowerCase();
  return OUTCOME_MAP[key] ?? "confirm";
}

/** Normalize date to YYYY-MM-DD for log_date. Handles Excel serial numbers and date strings. */
function normalizeDate(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === "number") {
    if (val < 1) return null;
    const jsDate = new Date((val - 25569) * 86400 * 1000);
    if (!Number.isNaN(jsDate.getTime())) return jsDate.toISOString().slice(0, 10);
    return null;
  }
  const s = safeStr(val);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!file || (typeof file !== "object" || !("arrayBuffer" in file))) {
    return NextResponse.json({ error: "No file uploaded. Use field name 'file' and upload a .xlsx or .xls file." }, { status: 400 });
  }
  const fileName = "name" in file && typeof file.name === "string" ? file.name : "file.xlsx";
  if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
    return NextResponse.json({ error: "File must be .xlsx or .xls" }, { status: 400 });
  }

  let rows: unknown[][];
  try {
    const arrayBuffer = await (file as Blob).arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
    }
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) {
      return NextResponse.json({ error: "Excel file has no sheets." }, { status: 400 });
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return NextResponse.json({ error: "Could not read first sheet." }, { status: 400 });
    }
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  } catch (err) {
    console.error("Excel parse error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to read Excel file: ${msg}` }, { status: 400 });
  }

  if (rows.length < 2) {
    return NextResponse.json({
      error: "No data rows (need a header row and at least one data row)",
      inserted: 0,
      skipped: 0,
      noFirm: 0,
      noSemester: 0,
    }, { status: 400 });
  }

  const rawHeaders = (rows[0] as unknown[]).map((h) => (h ?? "").toString().trim());
  const headers = rawHeaders.map((h) => h.toLowerCase());
  const BAP_LOG_STARTS = ["firm name", "organization", "session", "event date", "academic year", "semester", "speaker name", "outcome", "notes"];
  const exactBAP =
    headers.length >= 9 &&
    BAP_LOG_STARTS.every((start, i) => (headers[i] ?? "").toLowerCase().trim().startsWith(start));

  let firmNameCol: number;
  let organizationCol: number;
  let eventDateCol: number;
  let semesterCol: number;
  let academicYearCol: number;
  let outcomeCol: number;
  let notesCol: number;

  if (exactBAP) {
    firmNameCol = 0;
    organizationCol = 1;
    eventDateCol = 3;
    semesterCol = 5;
    academicYearCol = 4;
    outcomeCol = 7;
    notesCol = 8;
  } else {
    const col = (keywords: string[]) => findCol(headers, keywords);
    firmNameCol = col(["firm name", "firm", "organization", "company", "name"]);
    if (firmNameCol >= 0 && headers[firmNameCol]?.includes("organization") && headers[firmNameCol]?.includes("acct")) firmNameCol = -1;
    if (firmNameCol < 0) firmNameCol = col(["firm name", "firm", "company", "name"]);
    eventDateCol = col(["event date", "date", "log date"]);
    semesterCol = col(["semester (fall/spring)", "semester", "semester label", "fall/spring"]);
    academicYearCol = col(["academic year", "year"]);
    outcomeCol = col(["outcome (confirmed", "outcome", "status"]);
    notesCol = col(["notes", "session title/topic", "session title", "topic", "session type", "school"]);
    organizationCol = col(["organization (acct", "organization", "discipline"]);
  }

  if (firmNameCol === -1) {
    return NextResponse.json({
      error: "Required column not found. Include a column: Firm name, Organization, or Firm.",
      headersFound: rawHeaders,
    }, { status: 400 });
  }
  if (eventDateCol === -1) {
    return NextResponse.json({
      error: "Required column not found. Include a column: Event date or Date.",
      headersFound: rawHeaders,
    }, { status: 400 });
  }
  if (semesterCol === -1 && academicYearCol === -1) {
    return NextResponse.json({
      error: "Required column not found. Include Semester (e.g. Spring 2026) or Academic year.",
      headersFound: rawHeaders,
    }, { status: 400 });
  }

  const allSemesters = await db.query.semesters.findMany({
    columns: { id: true, label: true, year: true, term: true },
  });
  const semesterByLabel = new Map<string, { id: number }>();
  const semesterByYear = new Map<number, { id: number }>();
  for (const s of allSemesters) {
    const labelKey = s.label.trim().toLowerCase();
    semesterByLabel.set(labelKey, { id: s.id });
    semesterByYear.set(s.year, { id: s.id });
  }

  /** Parse "2016-2017" -> { startYear: 2016, endYear: 2017 }; "2016" -> { startYear: 2016, endYear: 2016 } */
  function parseAcademicYear(val: string): { startYear: number; endYear: number } | null {
    const s = val.replace(/\s/g, "").trim();
    const dash = s.indexOf("-");
    if (dash >= 0) {
      const a = parseInt(s.slice(0, dash), 10);
      const b = parseInt(s.slice(dash + 1), 10);
      if (!Number.isNaN(a) && !Number.isNaN(b)) return { startYear: a, endYear: b };
    }
    const n = parseInt(s, 10);
    if (!Number.isNaN(n)) return { startYear: n, endYear: n };
    return null;
  }

  const allFirms = await db.query.firms.findMany({ columns: { id: true, name: true } });
  const firmIdByName = new Map<string, number>();
  for (const f of allFirms) {
    const key = f.name.trim().toLowerCase();
    if (!firmIdByName.has(key)) firmIdByName.set(key, f.id);
  }

  let inserted = 0;
  let skipped = 0;
  let noFirm = 0;
  let noSemester = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const firmName = safeStr(getCell(row, firmNameCol));
    if (!firmName) {
      skipped++;
      continue;
    }

    const logDate = normalizeDate(getCell(row, eventDateCol));
    if (!logDate) {
      skipped++;
      continue;
    }

    let semesterId: number | null = null;
    const semesterVal = semesterCol >= 0 ? safeStr(getCell(row, semesterCol)) : "";
    const academicYearVal = academicYearCol >= 0 ? safeStr(getCell(row, academicYearCol)) : "";
    const termLower = semesterVal.toLowerCase();
    const acYear = parseAcademicYear(academicYearVal);
    const fallOrSpring = termLower === "fall" ? "fall" : termLower === "spring" ? "spring" : null;

    if (semesterVal && acYear && fallOrSpring) {
      const year = fallOrSpring === "fall" ? acYear.startYear : acYear.endYear;
      const label = (fallOrSpring === "fall" ? "Fall " : "Spring ") + year;
      const labelKey = label.toLowerCase();
      let match = semesterByLabel.get(labelKey);
      if (match) {
        semesterId = match.id;
      } else {
        const [newSem] = await db.insert(semesters).values({
          year,
          term: fallOrSpring,
          label,
        }).returning();
        if (newSem) {
          semesterId = newSem.id;
          semesterByLabel.set(labelKey, { id: newSem.id });
          semesterByYear.set(year, { id: newSem.id });
        }
      }
    }
    if (semesterId == null && semesterVal) {
      const match = semesterByLabel.get(semesterVal.toLowerCase());
      if (match) semesterId = match.id;
    }
    if (semesterId == null && acYear) {
      semesterId = semesterByYear.get(acYear.startYear)?.id ?? semesterByYear.get(acYear.endYear)?.id ?? null;
    }
    if (semesterId == null && academicYearVal) {
      const year = parseInt(String(academicYearVal).replace(/\s/g, ""), 10);
      if (!Number.isNaN(year)) semesterId = semesterByYear.get(year)?.id ?? null;
    }
    if (semesterId == null) {
      noSemester++;
      continue;
    }

    const firmKey = firmName.trim().toLowerCase();
    let firmId = firmIdByName.get(firmKey) ?? null;
    if (firmId == null) {
      const discipline = organizationCol >= 0 ? safeStr(getCell(row, organizationCol)) || null : null;
      const [newFirm] = await db.insert(firms).values({
        name: firmName.trim(),
        discipline,
        updatedAt: new Date(),
      }).returning();
      if (newFirm) {
        firmId = newFirm.id;
        firmIdByName.set(firmKey, newFirm.id);
      } else {
        noFirm++;
        continue;
      }
    }

    const outcomeVal = outcomeCol >= 0 ? safeStr(getCell(row, outcomeCol)) : "";
    const outcome = outcomeVal ? parseOutcome(outcomeVal) : "confirm";
    const notes = notesCol >= 0 ? safeStr(getCell(row, notesCol)) || null : null;

    const existingEvent = await db.query.events.findFirst({
      where: and(
        eq(events.firmId, firmId),
        eq(events.semesterId, semesterId)
      ),
      columns: { id: true },
    });
    let eventId: number | null = existingEvent?.id ?? null;
    if (!existingEvent) {
      const [newEvent] = await db.insert(events).values({
        firmId,
        semesterId,
        eventDate: logDate,
      }).returning();
      eventId = newEvent?.id ?? null;
    }

    try {
      await db.insert(speakerLogs).values({
        firmId,
        semesterId,
        eventId,
        logDate,
        outcome,
        thankYouSent: false,
        thankYouSentAt: null,
        notes,
        updatedAt: new Date(),
      });
      inserted++;
    } catch (rowErr) {
      console.error(`Speaker log import row ${i + 1} error:`, rowErr);
    }
  }

  return NextResponse.json({
    ok: true,
    inserted,
    skipped,
    noFirm,
    noSemester,
  });
  } catch (err) {
    console.error("Speaker logs import error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Import failed: ${message}` },
      { status: 500 }
    );
  }
}
