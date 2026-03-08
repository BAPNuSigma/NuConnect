import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbDir = process.env.DATABASE_URL
  ? path.dirname(process.env.DATABASE_URL)
  : path.join(process.cwd(), "data");
const dbPath = process.env.DATABASE_URL || path.join(dbDir, "nuconnect.db");

if (!process.env.DATABASE_URL) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch {
    // ignore
  }
}

const sqlite = new Database(dbPath);

// Ensure app_settings exists (e.g. if DB predates this table or drizzle push wasn't run)
try {
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
  );
} catch {
  // ignore
}

export const db = drizzle(sqlite, { schema });
export * from "./schema";
