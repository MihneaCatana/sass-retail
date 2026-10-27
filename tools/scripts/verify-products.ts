import { pool } from "../src/lib/db";
import { provisioning } from "../src/lib/provisioning";
import { assert, loginAndGetToken } from "../src/lib/oidc";

const API = "http://localhost:8082/api/products";

/**
 * End-to-end products CRUD verification (TICKET-101, run against the dev stack):
 *   - signs up a fresh tenant through the public flow (its admin holds
 *     the tenant-admin role)
 *   - logs in as that admin and exercises the full CRUD cycle
 *   - proves tenant-user reads work while writes stay admin-only
 *   - cleans up the tenant (the Keycloak user remains, harmless)
 *
 * Requires the API running via nginx (http://localhost:8082).
 */
async function main(): Promise<void> {
  const slug = `prod-${Math.random().toString(36).slice(2, 8)}`;
  const email = `admin-${slug}@products.test`;
  const password = "Verify-Products1";

  // ---- fresh tenant through the public signup flow ----
  const signup = await fetch("http://localhost:8082/api/onboarding/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyName: "Products Verify",
      slug,
      adminEmail: email,
      adminPassword: password
    })
  });
  assert(signup.status === 201, "signup -> 201 (fresh tenant with an admin)");

  // ---- tenant-admin: full CRUD cycle ----
  const admin = await loginAndGetToken(email, password);
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const created = await fetch(API, {
    method: "POST",
    headers: { ...auth(admin.accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Espresso beans 1kg", sku: "ESP-1KG", priceCents: 1899, stock: 25 })
  });
  const createdBody = (await created.json()) as {
    id: string;
    name: string;
    sku: string;
    priceCents: number;
    stock: number;
  };
  assert(created.status === 201, "admin creates a product -> 201");
  assert(
    createdBody.sku === "ESP-1KG" && createdBody.priceCents === 1899,
    "created product echoes the payload"
  );

  const list = await fetch(`${API}?q=espresso`, { headers: auth(admin.accessToken) });
  const listBody = (await list.json()) as { products: Array<{ id: string }>; total: number };
  assert(list.status === 200 && listBody.total === 1, "search by name finds the product");

  const updated = await fetch(`${API}/${createdBody.id}`, {
    method: "PUT",
    headers: { ...auth(admin.accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Espresso beans 1kg", sku: "ESP-1KG", priceCents: 1999, stock: 25 })
  });
  const updatedBody = (await updated.json()) as { priceCents: number; stock: number };
  assert(
    updated.status === 200 && updatedBody.priceCents === 1999 && updatedBody.stock === 25,
    "admin updates product metadata without overwriting stock"
  );

  const duplicate = await fetch(API, {
    method: "POST",
    headers: { ...auth(admin.accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Another", sku: "ESP-1KG", priceCents: 100, stock: 1 })
  });
  assert(duplicate.status === 409, "duplicate SKU -> 409");

  const invalid = await fetch(API, {
    method: "POST",
    headers: { ...auth(admin.accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ name: "", sku: "X", priceCents: -5, stock: 1 })
  });
  assert(invalid.status === 400, "invalid payload -> 400");

  // ---- tenant-user of ANOTHER tenant: reads work, writes are admin-only ----
  const tenantUser = await loginAndGetToken("demo-acme", "DemoAcme-Dev1");
  const userRead = await fetch(API, { headers: auth(tenantUser.accessToken) });
  assert(userRead.status === 200, "tenant-user can list products (read)");
  const userWrite = await fetch(API, {
    method: "POST",
    headers: { ...auth(tenantUser.accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Nope", sku: "NOPE-1", priceCents: 1, stock: 1 })
  });
  assert(userWrite.status === 403, "tenant-user write -> 403 (admin-only mutations)");

  // ---- cleanup ----
  await provisioning.dropTenant(slug, { force: true });
  const registry = await pool.query("SELECT 1 FROM public.tenants WHERE slug = $1", [slug]);
  assert(registry.rowCount === 0, "test tenant cleaned up");

  console.log("\nPRODUCTS CRUD VERIFICATION PASSED");
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
