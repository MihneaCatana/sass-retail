import { pool } from "../../db/pool";
import type { TenantAuditEntry, TenantSummary } from "@retail/shared-types";

export interface TenantRecord {
  id: string;
  slug: string;
  schemaName: string;
  name: string;
  status: string;
  plan: string;
}

interface TenantRow {
  id: string;
  slug: string;
  schema_name: string;
  name: string;
  status: string;
  plan: string;
}

interface TenantRegistryRow extends TenantRow {
  created_at: string;
  updated_at: string;
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

function mapRow(row: TenantRow): TenantRecord {
  return {
    id: row.id,
    slug: row.slug,
    schemaName: row.schema_name,
    name: row.name,
    status: row.status,
    plan: row.plan
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

  const result = await pool.query<TenantRow>(
    `SELECT id, slug, schema_name, name, status, plan
       FROM public.tenants
      WHERE slug = $1 AND status = 'active'`,
    [slug]
  );

  const tenant = result.rows.length > 0 ? mapRow(result.rows[0]) : null;

  // SEC-005: cache only positive lookups — misses (unknown or non-active
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
  const result = await pool.query<TenantRegistryRow>(
    `SELECT id, slug, schema_name, name, status, plan, created_at, updated_at
       FROM public.tenants
      ORDER BY created_at`
  );
  return result.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    schemaName: row.schema_name,
    name: row.name,
    // Registry rows carry a CHECK constraint on status; narrowing is safe.
    status: row.status as TenantSummary["status"],
    plan: row.plan,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  }));
}

/** Fetches a single registry tenant by slug regardless of status (platform-admin view). */
export async function getTenantBySlug(slug: string): Promise<TenantSummary | null> {
  const result = await pool.query<TenantRegistryRow>(
    `SELECT id, slug, schema_name, name, status, plan, created_at, updated_at
       FROM public.tenants
      WHERE slug = $1`,
    [slug]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    slug: row.slug,
    schemaName: row.schema_name,
    name: row.name,
    // Registry rows carry a CHECK constraint on status; narrowing is safe.
    status: row.status as TenantSummary["status"],
    plan: row.plan,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

interface AuditEntryRow {
  occurred_at: Date;
  actor: string;
  action: string;
  details: Record<string, unknown>;
}

/**
 * Recent audit entries referencing a tenant. The audit log carries no tenant
 * column; tenant-scoped actions store the slug inside their JSONB details,
 * so the lookup matches on `details->>'slug'`.
 */
export async function getRecentAuditForTenant(slug: string, limit = 20): Promise<TenantAuditEntry[]> {
  const result = await pool.query<AuditEntryRow>(
    `SELECT occurred_at, actor, action, details
       FROM public.audit_log
      WHERE details->>'slug' = $1
      ORDER BY occurred_at DESC
      LIMIT $2`,
    [slug, limit]
  );
  return result.rows.map((row) => ({
    occurredAt: new Date(row.occurred_at).toISOString(),
    actor: row.actor,
    action: row.action,
    details: row.details
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
