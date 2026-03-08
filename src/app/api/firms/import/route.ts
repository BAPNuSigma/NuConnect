import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/db";
import { firms } from "@/db/schema";

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

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded. Use field name 'file' and upload a .xlsx file." }, { status: 400 });
  }
  if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
    return NextResponse.json({ error: "File must be .xlsx or .xls" }, { status: 400 });
  }

  let rows: unknown[][];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  } catch (err) {
    console.error("Excel parse error:", err);
    return NextResponse.json({ error: "Failed to read Excel file" }, { status: 400 });
  }

  if (rows.length < 2) {
    return NextResponse.json({ inserted: 0, updated: 0, skipped: rows.length - 1, error: "No data rows (need a header row and at least one data row)" });
  }

  const rawHeaders = (rows[0] as unknown[]).map((h) => (h ?? "").toString().trim());
  const headers = rawHeaders.map((h) => h.toLowerCase());

  const BAP_HEADERS = [
    "organization discipline", "firm name", "contact first name", "contact last name",
    "email", "title", "practice area", "firm type", "industry focus", "location",
    "alumni connection", "personalization notes",
  ];
  const exactMatch =
    headers.length >= 12 &&
    BAP_HEADERS.every((h, i) => {
      const actual = (headers[i] ?? "").trim();
      return actual.includes(h) || actual.replace(/\s+/g, " ") === h || actual.replace(/\s/g, "") === h.replace(/\s/g, "");
    });

  let nameCol: number;
  let disciplineCol: number;
  let contactFirstCol: number;
  let contactLastCol: number;
  let emailCol: number;
  let titleCol: number;
  let practiceAreaCol: number;
  let firmTypeCol: number;
  let industryFocusCol: number;
  let locationCol: number;
  let alumniCol: number;
  let noteCol: number;

  if (exactMatch) {
    nameCol = 1;
    disciplineCol = 0;
    contactFirstCol = 2;
    contactLastCol = 3;
    emailCol = 4;
    titleCol = 5;
    practiceAreaCol = 6;
    firmTypeCol = 7;
    industryFocusCol = 8;
    locationCol = 9;
    alumniCol = 10;
    noteCol = 11;
  } else {
    const col = (keywords: string[]) => findCol(headers, keywords);
    nameCol = col(["firm name", "firm"]);
    if (nameCol < 0) {
      const fallback = col(["company", "name", "organization"]);
      if (fallback >= 0 && !headers[fallback].includes("discipline")) nameCol = fallback;
    }
    if (nameCol === -1) {
      return NextResponse.json({
        error: "Required column not found. First row must include a column named something like: Firm Name, Company, Name, or Organization.",
        headersFound: rawHeaders,
      }, { status: 400 });
    }
    disciplineCol = col(["organization discipline", "discipline"]);
    contactFirstCol = col(["contact first name", "contact first", "first name"]);
    contactLastCol = col(["contact last name", "contact last", "last name"]);
    emailCol = col(["email", "contact email"]);
    titleCol = col(["title"]);
    practiceAreaCol = col(["practice area"]);
    firmTypeCol = col(["firm type", "type"]);
    industryFocusCol = col(["industry focus", "industry"]);
    locationCol = col(["location"]);
    alumniCol = col(["alumni connection", "alumni"]);
    noteCol = col(["personalization notes", "personalized note", "personalized", "notes", "note"]);
  }

  let inserted = 0;
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const name = safeStr(getCell(row, nameCol));
    if (!name) {
      skipped++;
      continue;
    }

    const now = new Date();
    const discipline = safeStr(getCell(row, disciplineCol)) || null;
    const contactFirstName = safeStr(getCell(row, contactFirstCol)) || null;
    const contactLastName = safeStr(getCell(row, contactLastCol)) || null;
    const contactEmail = safeStr(getCell(row, emailCol)) || null;
    const title = safeStr(getCell(row, titleCol)) || null;
    const practiceArea = safeStr(getCell(row, practiceAreaCol)) || null;
    const firmType = safeStr(getCell(row, firmTypeCol)) || null;
    const industryFocus = safeStr(getCell(row, industryFocusCol)) || null;
    const location = safeStr(getCell(row, locationCol)) || null;
    const alumniConnection = safeStr(getCell(row, alumniCol)) || null;
    const personalizedNote = safeStr(getCell(row, noteCol)) || null;
    const notes = safeStr(getCell(row, noteCol)) || null;

    await db.insert(firms).values({
      name,
      discipline,
      contactFirstName,
      contactLastName,
      contactEmail: contactEmail || null,
      title,
      practiceArea,
      firmType,
      industryFocus,
      location,
      alumniConnection,
      personalizedNote,
      notes,
      updatedAt: now,
    });
    inserted++;
  }

  return NextResponse.json({ ok: true, inserted, skipped });
}
