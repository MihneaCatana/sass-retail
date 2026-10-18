import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  tenantId: string;
  slug: string;
  /** Postgres schema name, e.g. `t_acme` */
  schema: string;
  name: string;
  userId?: string;
  roles: string[];
}

const tenantAls = new AsyncLocalStorage<TenantContext>();

/** Runs `fn` with the tenant context available via getTenantContext(). */
export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return tenantAls.run(ctx, fn);
}

/** Throws if no context is set — the endpoint was not behind tenantContext middleware. */
export function getTenantContext(): TenantContext {
  const ctx = tenantAls.getStore();
  if (!ctx) {
    throw new Error("No tenant context. This endpoint must be mounted behind the tenantContext middleware.");
  }
  return ctx;
}
