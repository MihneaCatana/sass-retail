import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({ db: { select: vi.fn() } }));

// The store talks to Drizzle; tests stub the query chain (select -> from ->
// where -> orderBy -> limit is awaitable) instead of a pool.
vi.mock("../../db/drizzle", () => ({ db }));

import {
  getActiveTenantBySlug,
  getRecentAuditForTenant,
  getTenantBySlug,
  listAllTenants,
  resetTenantCacheForTests,
  tenantCacheSize
} from "./tenantStore";

/** A minimal awaitable chain matching how the store consumes Drizzle. */
function returning(rows: unknown[], capture?: { limit?: number }) {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    offset: () => chain,
    limit: (value: number) => {
      if (capture) capture.limit = value;
      return chain;
    },
    then: (
      onFulfilled: (value: unknown[]) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(rows).then(onFulfilled, onRejected)
  };
  return chain;
}

const tenantRow = (slug: string, status = "active") => ({
  id: `id-${slug}`,
  slug,
  schemaName: `t_${slug.replace(/-/g, "_")}`,
  name: `Tenant ${slug}`,
  status,
  plan: "starter",
  createdAt: new Date("2026-01-01T10:00:00Z"),
  updatedAt: new Date("2026-01-05T10:00:00Z")
});

const summary = (slug: string, status = "active") => ({
  id: `id-${slug}`,
  slug,
  schemaName: `t_${slug.replace(/-/g, "_")}`,
  name: `Tenant ${slug}`,
  status,
  plan: "starter",
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-05T10:00:00.000Z"
});

describe("listAllTenants", () => {
  beforeEach(() => {
    db.select.mockReset();
    resetTenantCacheForTests();
  });

  it("returns every tenant mapped to the shared TenantSummary DTO", async () => {
    db.select.mockReturnValueOnce(returning([tenantRow("acme"), tenantRow("globex", "suspended")]));

    const tenants = await listAllTenants();

    expect(tenants).toEqual([summary("acme"), summary("globex", "suspended")]);
  });

  it("returns an empty list when the registry is empty", async () => {
    db.select.mockReturnValueOnce(returning([]));

    const tenants = await listAllTenants();

    expect(tenants).toEqual([]);
  });
});

describe("getTenantBySlug", () => {
  beforeEach(() => {
    db.select.mockReset();
    resetTenantCacheForTests();
  });

  it("returns the tenant regardless of status, mapped to TenantSummary", async () => {
    db.select.mockReturnValueOnce(returning([tenantRow("acme", "suspended")]));

    const tenant = await getTenantBySlug("acme");

    expect(tenant).toEqual(summary("acme", "suspended"));
  });

  it("returns null for unknown slugs", async () => {
    db.select.mockReturnValueOnce(returning([]));

    const tenant = await getTenantBySlug("ghost");

    expect(tenant).toBeNull();
  });
});

describe("getActiveTenantBySlug", () => {
  beforeEach(() => {
    db.select.mockReset();
    resetTenantCacheForTests();
  });

  it("caches positive lookups and does not hit the DB again within the TTL", async () => {
    db.select.mockReturnValueOnce(returning([tenantRow("acme")]));

    const first = await getActiveTenantBySlug("acme");
    const second = await getActiveTenantBySlug("acme");

    expect(first?.schemaName).toBe("t_acme");
    expect(second?.id).toBe(first?.id);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("does NOT cache misses - unknown slugs hit the DB every time (SEC-005)", async () => {
    db.select.mockReturnValue(returning([]));

    await getActiveTenantBySlug("nope");
    await getActiveTenantBySlug("nope");
    await getActiveTenantBySlug("nope");

    expect(db.select).toHaveBeenCalledTimes(3);
    expect(tenantCacheSize()).toBe(0);
  });

  it("treats non-active tenants as misses (never cached, returns null)", async () => {
    db.select.mockReturnValue(returning([]));

    const tenant = await getActiveTenantBySlug("suspended");

    expect(tenant).toBeNull();
    expect(tenantCacheSize()).toBe(0);
  });

  it("evicts the oldest entries once the cache cap is exceeded (SEC-005)", async () => {
    db.select.mockImplementation(() => returning([tenantRow("x")]));

    for (let i = 0; i < 1_100; i += 1) {
      await getActiveTenantBySlug(`t${i}`);
    }
    expect(tenantCacheSize()).toBeLessThanOrEqual(1_000);

    // The oldest entry (t0) was evicted: re-querying it must hit the DB again.
    const callsBefore = db.select.mock.calls.length;
    await getActiveTenantBySlug("t0");
    expect(db.select.mock.calls.length).toBe(callsBefore + 1);
  });
});

describe("getRecentAuditForTenant", () => {
  const capture: { limit?: number } = {};

  beforeEach(() => {
    db.select.mockReset();
  });

  it("returns recent entries referencing the tenant via details.slug", async () => {
    db.select.mockReturnValueOnce(
      returning(
        [
          {
            id: "a1",
            occurredAt: new Date("2026-06-01T12:00:00Z"),
            actor: "admin@retail.local",
            action: "tenant.created",
            details: { slug: "acme", name: "Acme" }
          }
        ],
        capture
      )
    );

    const entries = await getRecentAuditForTenant("acme");

    expect(capture.limit).toBe(20);
    expect(entries).toEqual([
      {
        occurredAt: "2026-06-01T12:00:00.000Z",
        actor: "admin@retail.local",
        action: "tenant.created",
        details: { slug: "acme", name: "Acme" }
      }
    ]);
  });

  it("honours a custom limit", async () => {
    const customCapture: { limit?: number } = {};
    db.select.mockReturnValueOnce(returning([], customCapture));

    await getRecentAuditForTenant("acme", 5);

    expect(customCapture.limit).toBe(5);
  });
});
