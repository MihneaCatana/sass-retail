import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("../../db/pool", () => ({
  pool: { query: queryMock }
}));

import {
  getActiveTenantBySlug,
  resetTenantCacheForTests,
  tenantCacheSize
} from "./tenantStore";

describe("getActiveTenantBySlug", () => {
  beforeEach(() => {
    queryMock.mockReset();
    resetTenantCacheForTests();
  });

  const row = (slug: string) => ({
    id: `id-${slug}`,
    slug,
    schema_name: `t_${slug.replace(/-/g, "_")}`,
    name: `Tenant ${slug}`,
    status: "active",
    plan: "starter"
  });

  it("caches positive lookups and does not hit the DB again within the TTL", async () => {
    queryMock.mockResolvedValueOnce({ rows: [row("acme")] });

    const first = await getActiveTenantBySlug("acme");
    const second = await getActiveTenantBySlug("acme");

    expect(first?.schemaName).toBe("t_acme");
    expect(second?.id).toBe(first?.id);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT cache misses — unknown slugs hit the DB every time (SEC-005)", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await getActiveTenantBySlug("nope");
    await getActiveTenantBySlug("nope");
    await getActiveTenantBySlug("nope");

    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(tenantCacheSize()).toBe(0);
  });

  it("treats non-active tenants as misses (never cached, returns null)", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const tenant = await getActiveTenantBySlug("suspended");

    expect(tenant).toBeNull();
    expect(tenantCacheSize()).toBe(0);
  });

  it("evicts the oldest entries once the cache cap is exceeded (SEC-005)", async () => {
    queryMock.mockImplementation((_sql: string, params: string[]) =>
      Promise.resolve({ rows: [row(params[0])] })
    );

    for (let i = 0; i < 1_100; i += 1) {
      await getActiveTenantBySlug(`t${i}`);
    }
    expect(tenantCacheSize()).toBeLessThanOrEqual(1_000);

    // The oldest entry (t0) was evicted: re-querying it must hit the DB again.
    const callsBefore = queryMock.mock.calls.length;
    await getActiveTenantBySlug("t0");
    expect(queryMock.mock.calls.length).toBe(callsBefore + 1);
  });
});
