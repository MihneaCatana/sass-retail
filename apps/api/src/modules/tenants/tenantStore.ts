import { pool } from "../../db/pool";

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

/** Exposed for unit tests to reset cache state between cases. */
export function resetTenantCacheForTests(): void {
  cache.clear();
}

/** Current number of cached (positive) entries; lets tests assert the bound. */
export function tenantCacheSize(): number {
  return cache.size;
}
