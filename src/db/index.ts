import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!databaseUrl) {
  throw new Error("TURSO_DATABASE_URL is required to initialize the database connection.");
}

const isLocalFileDatabase = databaseUrl.startsWith("file:");

if (!isLocalFileDatabase && !authToken) {
  throw new Error(
    "TURSO_AUTH_TOKEN is required for remote Turso/libSQL database connections."
  );
}

const client = createClient({
  url: databaseUrl,
  authToken: isLocalFileDatabase ? undefined : authToken,
});

export const db = drizzle(client, { schema });
export * from "./schema";
