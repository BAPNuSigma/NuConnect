import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!databaseUrl) {
  throw new Error("TURSO_DATABASE_URL is required for Drizzle Kit commands.");
}

const isLocalFileDatabase = databaseUrl.startsWith("file:");

if (!isLocalFileDatabase && !authToken) {
  throw new Error("TURSO_AUTH_TOKEN is required for remote Turso/libSQL Drizzle Kit commands.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: databaseUrl,
    authToken: isLocalFileDatabase ? undefined : authToken,
  },
});
