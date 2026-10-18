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
const cache = new Map<string, { value: TenantRecord | null; expiresAt: number }>();

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

/** Resolves an ACTIVE tenant by slug, with a short-lived positive cache. */
export async function getActiveTenantBySlug(slug: string): Promise<TenantRecord | null> {
  const cached = cache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const result = await pool.query<TenantRow>(
    `SELECT id, slug, schema_name, name, status, plan
       FROM public.tenants
      WHERE slug = $1 AND status = 'active'`,
    [slug]
  );

  const tenant = result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  cache.set(slug, { value: tenant, expiresAt: Date.now() + CACHE_TTL_MS });
  return tenant;
}
