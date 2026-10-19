import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/drizzle";
import type { TenantAuditEntry, TenantSummary } from "@retail/shared-types";
import { auditLog } from "../../shared/audit.schema";
import { tenants } from "./tenants.schema";

export interface TenantRecord {
  id: string;
  slug: string;
  schemaName: string;
  name: string;
  status: string;
  plan: string;
}

const CACHE_TTL_MS = 30_000;
/**
 * SEC-005 (TICKET-105): hard cap on cached entries. Tenant slugs arrive from
 * user-supplied JWTs, so an attacker could otherwise spray arbitrary slugs
 * and grow the cache unbounded. Positive-lookups-only + this LRU cap bound
 * the cache by min(active tenants, CACHE_MAX_ENTRIES).
 */
const CACHE_MAX_ENTRIES = 1_000;
/** Map iterates in insertion order; re-inserting on hit gives LRU behavior. */
const cache = new Map<string, { value: TenantRecord; expiresAt: number }>();

function mapTenantRow(row: typeof tenants.$inferSelect): TenantRecord {
  return {
    id: row.id,
    slug: row.slug,
    schemaName: row.schemaName,
    name: row.name,
    status: row.status,
    plan: row.plan
  };
}

function toSummary(row: typeof tenants.$inferSelect): TenantSummary {
  return {
    id: row.id,
    slug: row.slug,
    schemaName: row.schemaName,
    name: row.name,
    // Registry rows carry a CHECK constraint on status; narrowing is safe.
    status: row.status as TenantSummary["status"],
    plan: row.plan,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

/** Resolves an ACTIVE tenant by slug using a short-lived, bounded, positive-only cache. */
export async function getActiveTenantBySlug(slug: string): Promise<TenantRecord | null> {
  const cached = cache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    // Refresh recency so hot entries survive eviction.
    cache.delete(slug);
    cache.set(slug, cached);
    return cached.value;
  }

  const [row] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.slug, slug), eq(tenants.status, "active")));

  const tenant = row ? mapTenantRow(row) : null;

  // SEC-005: cache only positive lookups - misses (unknown or non-active
  // slugs) hit the DB every time instead of accumulating cache entries.
  if (tenant) {
    cache.set(slug, { value: tenant, expiresAt: Date.now() + CACHE_TTL_MS });
    while (cache.size > CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }
  return tenant;
}

/** Lists every tenant in the registry, oldest first (platform-admin view). */
export async function listAllTenants(): Promise<TenantSummary[]> {
  const rows = await db.select().from(tenants).orderBy(asc(tenants.createdAt));
  return rows.map(toSummary);
}

/** Fetches a single registry tenant by slug regardless of status (platform-admin view). */
export async function getTenantBySlug(slug: string): Promise<TenantSummary | null> {
  const [row] = await db.select().from(tenants).where(eq(tenants.slug, slug));
  return row ? toSummary(row) : null;
}

/**
 * Recent audit entries referencing a tenant. The audit log carries no tenant
 * column; tenant-scoped actions store the slug inside their JSONB details,
 * so the lookup matches on `details->>'slug'`.
 */
export async function getRecentAuditForTenant(slug: string, limit = 20): Promise<TenantAuditEntry[]> {
  const rows = await db
    .select()
    .from(auditLog)
    .where(sql`${auditLog.details} ->> 'slug' = ${slug}`)
    .orderBy(desc(auditLog.occurredAt))
    .limit(limit);
  return rows.map((row) => ({
    occurredAt: row.occurredAt.toISOString(),
    actor: row.actor,
    action: row.action,
    details: row.details as Record<string, unknown>
  }));
}

/** Exposed for unit tests to reset cache state between cases. */
export function resetTenantCacheForTests(): void {
  cache.clear();
}

/** Current number of cached (positive) entries; lets tests assert the bound. */
export function tenantCacheSize(): number {
  return cache.size;
}
