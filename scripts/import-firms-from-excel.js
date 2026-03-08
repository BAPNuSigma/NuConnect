/**
 * Import firms from "Firm Invite Agent (1).xlsx" into the NuConnect DB.
 * Run from project root: node scripts/import-firms-from-excel.js
 * Maps: organization/name, discipline, contact first/last, email, title,
 *       practice area, firm type, industry focus, location, alumni connection, personalized note.
 */

const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const excelPath = path.join(process.env.USERPROFILE || process.env.HOME, "Downloads", "Firm Invite Agent (1).xlsx");
const altPath = "c:\\Users\\jackc\\Downloads\\Firm Invite Agent (1).xlsx";

function getDb() {
  const dbPath = path.join(process.cwd(), "data", "nuconnect.db");
  if (!fs.existsSync(dbPath)) {
    throw new Error("Database not found at " + dbPath + ". Run from project root after npm run db:push");
  }
  const Database = require("better-sqlite3");
  return new Database(dbPath);
}

function findCol(headers, keywords) {
  for (let c = 0; c < headers.length; c++) {
    const h = (headers[c] || "").toString().trim().toLowerCase();
    for (const kw of keywords) {
      if (h.includes(kw)) return c;
    }
  }
  return -1;
}

function safeStr(val) {
  if (val == null) return "";
  const s = String(val).trim();
  return s === "" || s.toLowerCase() === "n/a" ? "" : s;
}

function main() {
  const filePath = fs.existsSync(excelPath) ? excelPath : altPath;
  if (!fs.existsSync(filePath)) {
    console.error("Excel file not found at:", excelPath, "or", altPath);
    process.exit(1);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (rows.length < 2) {
    console.log("No data rows in sheet.");
    process.exit(0);
  }

  const headers = rows[0].map((h) => (h || "").toString().trim().toLowerCase());
  const nameCol = findCol(headers, ["firm", "company", "name", "organization"]);
  if (nameCol === -1) {
    console.log("Headers:", headers);
    console.error("Could not find organization/firm/name column.");
    process.exit(1);
  }

  const col = (keywords) => findCol(headers, keywords);
  const db = getDb();

  const insert = db.prepare(`
    INSERT INTO firms (name, discipline, contact_first_name, contact_last_name, contact_email, title,
      practice_area, firm_type, industry_focus, location, alumni_connection, personalized_note, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const update = db.prepare(`
    UPDATE firms SET discipline = ?, contact_first_name = ?, contact_last_name = ?, contact_email = ?, title = ?,
      practice_area = ?, firm_type = ?, industry_focus = ?, location = ?, alumni_connection = ?, personalized_note = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `);
  const selectExisting = db.prepare("SELECT id FROM firms WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))");

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const disciplineCol = col(["discipline"]);
  const contactFirstCol = col(["contact first", "first name", "contact first name"]);
  const contactLastCol = col(["contact last", "last name", "contact last name"]);
  const emailCol = col(["email", "contact email"]);
  const titleCol = col(["title"]);
  const practiceAreaCol = col(["practice area"]);
  const firmTypeCol = col(["firm type", "type"]);
  const industryFocusCol = col(["industry focus", "industry"]);
  const locationCol = col(["location"]);
  const alumniCol = col(["alumni", "alumni connection"]);
  const noteCol = col(["personalized note", "personalized", "note", "notes"]);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = safeStr(row[nameCol]);
    if (!name) {
      skipped++;
      continue;
    }

    const now = Math.floor(Date.now() / 1000);
    const vals = {
      discipline: safeStr(row[disciplineCol]),
      contactFirstName: safeStr(row[contactFirstCol]),
      contactLastName: safeStr(row[contactLastCol]),
      contactEmail: safeStr(row[emailCol]) || null,
      title: safeStr(row[titleCol]),
      practiceArea: safeStr(row[practiceAreaCol]),
      firmType: safeStr(row[firmTypeCol]),
      industryFocus: safeStr(row[industryFocusCol]),
      location: safeStr(row[locationCol]),
      alumniConnection: safeStr(row[alumniCol]),
      personalizedNote: safeStr(row[noteCol]),
      notes: safeStr(row[noteCol]),
    };

    const existing = selectExisting.get(name);
    if (existing) {
      update.run(
        vals.discipline || null, vals.contactFirstName || null, vals.contactLastName || null, vals.contactEmail,
        vals.title || null, vals.practiceArea || null, vals.firmType || null, vals.industryFocus || null,
        vals.location || null, vals.alumniConnection || null, vals.personalizedNote || null, vals.notes || null,
        now, existing.id
      );
      updated++;
    } else {
      insert.run(
        name, vals.discipline || null, vals.contactFirstName || null, vals.contactLastName || null, vals.contactEmail,
        vals.title || null, vals.practiceArea || null, vals.firmType || null, vals.industryFocus || null,
        vals.location || null, vals.alumniConnection || null, vals.personalizedNote || null, vals.notes || null,
        now, now
      );
      inserted++;
    }
  }

  db.close();
  console.log("Done. Inserted:", inserted, "Updated:", updated, "Skipped (empty name):", skipped);
}

main();
