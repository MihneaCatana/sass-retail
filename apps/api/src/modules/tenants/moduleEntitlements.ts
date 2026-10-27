import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { WORKSPACE_MODULE_KEYS, type WorkspaceModuleKey } from "@retail/shared-types";
import { db } from "../../db/drizzle";
import { tenantModuleEntitlements } from "./moduleEntitlements.schema";

const CACHE_TTL_MS = 10_000;
const CACHE_MAX_ENTRIES = 1_000;
const cache = new Map<string, { enabledModules: WorkspaceModuleKey[]; expiresAt: number }>();

export async function getEnabledModules(tenantId: string): Promise<WorkspaceModuleKey[]> {
  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return [...cached.enabledModules];

  const rows = await db
    .select({ moduleKey: tenantModuleEntitlements.moduleKey })
    .from(tenantModuleEntitlements)
    .where(and(eq(tenantModuleEntitlements.tenantId, tenantId), eq(tenantModuleEntitlements.enabled, true)));
  const enabledModules = rows
    .map((row) => row.moduleKey)
    .filter((key): key is WorkspaceModuleKey => WORKSPACE_MODULE_KEYS.includes(key as WorkspaceModuleKey));

  cache.set(tenantId, { enabledModules, expiresAt: Date.now() + CACHE_TTL_MS });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return [...enabledModules];
}

export async function replaceTenantModules(tenantId: string, enabledModules: WorkspaceModuleKey[]): Promise<void> {
  await db.execute(sql`SELECT public.set_tenant_module_entitlements(${tenantId}::uuid, ${enabledModules}::text[])`);
  cache.delete(tenantId);
}

export function resetModuleEntitlementCacheForTests(): void {
  cache.clear();
}
