import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("../../db/pool", () => ({
  pool: { query: queryMock }
}));

import {
  getActiveTenantBySlug,
  getRecentAuditForTenant,
  getTenantBySlug,
  listAllTenants,
  resetTenantCacheForTests,
  tenantCacheSize
} from "./tenantStore";


describe("listAllTenants", () => {
  beforeEach(() => {
    queryMock.mockReset();
    resetTenantCacheForTests();
  });

  it("returns every tenant mapped to the shared TenantSummary DTO", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: "id-1",
          slug: "acme",
          schema_name: "t_acme",
          name: "Acme",
          status: "active",
          plan: "free",
          created_at: "2026-01-01T10:00:00Z",
          updated_at: "2026-01-05T10:00:00Z"
        },
        {
          id: "id-2",
          slug: "globex",
          schema_name: "t_globex",
          name: "Globex",
          status: "suspended",
          plan: "starter",
          created_at: "2026-02-01T10:00:00Z",
          updated_at: "2026-02-05T10:00:00Z"
        }
      ]
    });

    const tenants = await listAllTenants();

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("FROM public.tenants")
    );
    expect(tenants).toEqual([
      {
        id: "id-1",
        slug: "acme",
        schemaName: "t_acme",
        name: "Acme",
        status: "active",
        plan: "free",
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-01-05T10:00:00.000Z"
      },
      {
        id: "id-2",
        slug: "globex",
        schemaName: "t_globex",
        name: "Globex",
        status: "suspended",
        plan: "starter",
        createdAt: "2026-02-01T10:00:00.000Z",
        updatedAt: "2026-02-05T10:00:00.000Z"
      }
    ]);
  });

  it("returns an empty list when the registry is empty", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const tenants = await listAllTenants();

    expect(tenants).toEqual([]);
  });
});

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
describe("getTenantBySlug", () => {
  beforeEach(() => {
    queryMock.mockReset();
    resetTenantCacheForTests();
  });

  it("returns the tenant regardless of status, mapped to TenantSummary", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: "id-1",
          slug: "acme",
          schema_name: "t_acme",
          name: "Acme",
          status: "suspended",
          plan: "free",
          created_at: "2026-05-01T10:00:00Z",
          updated_at: "2026-05-02T10:00:00Z"
        }
      ]
    });

    const tenant = await getTenantBySlug("acme");

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("WHERE slug = $1"), ["acme"]);
    expect(tenant).toEqual({
      id: "id-1",
      slug: "acme",
      schemaName: "t_acme",
      name: "Acme",
      status: "suspended",
      plan: "free",
      createdAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-02T10:00:00.000Z"
    });
  });

  it("returns null for unknown slugs", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const tenant = await getTenantBySlug("ghost");

    expect(tenant).toBeNull();
  });
});

describe("getRecentAuditForTenant", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns recent entries referencing the tenant via details.slug", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          occurred_at: new Date("2026-06-01T12:00:00Z"),
          actor: "admin@retail.local",
          action: "tenant.created",
          details: { slug: "acme", name: "Acme" }
        }
      ]
    });

    const entries = await getRecentAuditForTenant("acme");

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("details->>'slug' = $1"), [
      "acme",
      20
    ]);
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
    queryMock.mockResolvedValueOnce({ rows: [] });

    await getRecentAuditForTenant("acme", 5);

    expect(queryMock).toHaveBeenCalledWith(expect.anything(), ["acme", 5]);
  });
});

