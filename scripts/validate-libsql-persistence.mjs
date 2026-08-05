/**
 * Validate that writes to the configured libSQL database persist across
 * separate client connections. Exits with a non-zero code on failure.
 *
 * Never prints TURSO_AUTH_TOKEN.
 */

import { createClient } from "@libsql/client";

function getClient() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is required.");
  }

  const isLocalFileDatabase = databaseUrl.startsWith("file:");
  const isRemoteLibsql = databaseUrl.startsWith("libsql://");

  if (!isLocalFileDatabase && isRemoteLibsql && !authToken) {
    throw new Error("TURSO_AUTH_TOKEN is required for remote libsql:// database connections.");
  }

  return createClient({
    url: databaseUrl,
    authToken: isLocalFileDatabase ? undefined : authToken,
  });
}

function generateSuffix() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function main() {
  const suffix = generateSuffix();
  const settingsKey = `__persistence_test_${suffix}__`;
  const semesterLabel = `__persistence_test_${suffix}__`;

  let firstClient;

  try {
    firstClient = getClient();

    await firstClient.execute({
      sql: `INSERT INTO app_settings (key, value) VALUES (?, ?)`,
      args: [settingsKey, "test-value"],
    });

    const semesterResult = await firstClient.execute({
      sql: `INSERT INTO semesters (year, term, label) VALUES (?, ?, ?)`,
      args: [2099, "spring", semesterLabel],
    });
    const semesterId = semesterResult.lastInsertRowid;
    if (semesterId == null) {
      throw new Error("Failed to retrieve inserted semester id.");
    }

    await firstClient.close();
    firstClient = null;

    const secondClient = getClient();
    try {
      const settingsResult = await secondClient.execute({
        sql: `SELECT key, value FROM app_settings WHERE key = ?`,
        args: [settingsKey],
      });

      if (settingsResult.rows.length === 0) {
        throw new Error(`Persisted app_settings row with key ${settingsKey} was not found by a new client.`);
      }

      const storedValue = settingsResult.rows[0].value;
      if (storedValue !== "test-value") {
        throw new Error(`Unexpected persisted app_settings value: ${storedValue}`);
      }

      const semesterResult2 = await secondClient.execute({
        sql: `SELECT id, year, term, label FROM semesters WHERE id = ?`,
        args: [semesterId],
      });

      if (semesterResult2.rows.length === 0) {
        throw new Error(`Persisted semester with id ${semesterId} was not found by a new client.`);
      }

      const storedSemester = semesterResult2.rows[0];
      if (storedSemester.label !== semesterLabel) {
        throw new Error(`Unexpected persisted semester label: ${storedSemester.label}`);
      }

      await secondClient.execute({
        sql: `DELETE FROM app_settings WHERE key = ?`,
        args: [settingsKey],
      });
      await secondClient.execute({
        sql: `DELETE FROM semesters WHERE id = ?`,
        args: [semesterId],
      });
    } finally {
      await secondClient.close();
    }

    console.log("Persistence validation passed.");
  } catch (err) {
    if (firstClient) {
      try {
        await firstClient.close();
      } catch {
        // ignore close errors during cleanup
      }
    }

    // Ensure the auth token is never written to stderr/stdout.
    const message = err instanceof Error ? err.message : String(err);
    const safeMessage = message.replace(/TURSO_AUTH_TOKEN=[^\s]*/gi, "TURSO_AUTH_TOKEN=***");
    console.error("Persistence validation failed:", safeMessage);
    process.exit(1);
  }
}

main();
