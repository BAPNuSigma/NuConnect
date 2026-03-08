import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbDir = process.env.DATABASE_URL
  ? path.dirname(process.env.DATABASE_URL)
  : path.join(process.cwd(), "data");
const dbPath = process.env.DATABASE_URL || path.join(dbDir, "nuconnect.db");

// Ensure directory exists. When DATABASE_URL points at a Render disk (e.g. /var/data),
// the directory doesn't exist during *build* (disk is only mounted at runtime). Use
// in-memory so the build succeeds; at runtime the disk is mounted and we use the real path.
let pathToOpen = dbPath;
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch {
    // ignore (e.g. build: disk not mounted)
  }
  if (!fs.existsSync(dbDir)) {
    pathToOpen = ":memory:";
  }
}

const sqlite = new Database(pathToOpen);

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
