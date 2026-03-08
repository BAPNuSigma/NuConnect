import { defineConfig } from "drizzle-kit";
import path from "path";

// Use same path as app (DATABASE_URL on Render = /var/data/nuconnect.db)
const dbUrl = process.env.DATABASE_URL || path.join(process.cwd(), "data", "nuconnect.db");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: dbUrl },
});
