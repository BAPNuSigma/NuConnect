/**
 * Backfill organizations for existing firms rows.
 *
 * Groups existing firms by trimmed, lowercased name and creates one organizations
 * row per group, then points every firm in that group at it via organization_id.
 * Safe to re-run: only firms with organization_id IS NULL are touched, and
 * organizations are matched by name_key before inserting a new one.
 *
 * Run from project root AFTER `npm run db:push` has added the organizations table
 * and firms.organization_id column:
 *   node scripts/backfill-organizations.mjs
 *
 * Uses the same TURSO_DATABASE_URL / TURSO_AUTH_TOKEN env vars as the app.
 */

import { createClient } from "@libsql/client";

function getClient() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is required. Set it to a file: URL for local use or a libsql:// URL for remote.");
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

function normalizeName(name) {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function main() {
  const client = getClient();
  try {
    const firmsResult = await client.execute(
      `SELECT id, name FROM firms WHERE organization_id IS NULL`
    );
    const firms = firmsResult.rows;
    if (firms.length === 0) {
      console.log("No firms with a missing organization_id. Nothing to backfill.");
      return;
    }

    const groups = new Map(); // nameKey -> { name, firmIds: [] }
    for (const firm of firms) {
      const nameKey = normalizeName(firm.name) || `firm:${firm.id}`;
      if (!groups.has(nameKey)) {
        groups.set(nameKey, { name: (firm.name ?? "").trim() || String(firm.id), firmIds: [] });
      }
      groups.get(nameKey).firmIds.push(firm.id);
    }

    let organizationsCreated = 0;
    let organizationsReused = 0;
    let firmsUpdated = 0;

    for (const [nameKey, group] of groups) {
      const existing = await client.execute({
        sql: `SELECT id FROM organizations WHERE name_key = ?`,
        args: [nameKey],
      });

      let organizationId;
      if (existing.rows.length > 0) {
        organizationId = existing.rows[0].id;
        organizationsReused++;
      } else {
        const now = Date.now();
        const inserted = await client.execute({
          sql: `INSERT INTO organizations (name, name_key, created_at, updated_at) VALUES (?, ?, ?, ?)`,
          args: [group.name, nameKey, now, now],
        });
        organizationId = inserted.lastInsertRowid;
        organizationsCreated++;
      }

      for (const firmId of group.firmIds) {
        await client.execute({
          sql: `UPDATE firms SET organization_id = ? WHERE id = ? AND organization_id IS NULL`,
          args: [organizationId, firmId],
        });
        firmsUpdated++;
      }
    }

    console.log(
      `Backfill complete. Organizations created: ${organizationsCreated}, reused: ${organizationsReused}. Firms updated: ${firmsUpdated}.`
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
