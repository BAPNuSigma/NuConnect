import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";

export function normalizeOrgName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Find-or-create the organization for a company name (matched case/whitespace-insensitively).
 * All contacts (firms rows) that share a company should share one organizationId so the
 * 1-year eligibility rule applies per company, not per contact.
 */
export async function resolveOrganizationId(dbInstance: typeof db, name: string): Promise<number> {
  const nameKey = normalizeOrgName(name);
  const existing = await dbInstance.query.organizations.findFirst({
    where: eq(organizations.nameKey, nameKey),
    columns: { id: true },
  });
  if (existing) return existing.id;

  const [inserted] = await dbInstance
    .insert(organizations)
    .values({ name: name.trim(), nameKey, updatedAt: new Date() })
    .onConflictDoNothing({ target: organizations.nameKey })
    .returning({ id: organizations.id });
  if (inserted) return inserted.id;

  // Lost a race with a concurrent insert; the row now exists.
  const row = await dbInstance.query.organizations.findFirst({
    where: eq(organizations.nameKey, nameKey),
    columns: { id: true },
  });
  if (!row) throw new Error(`Failed to resolve organization for "${name}"`);
  return row.id;
}
