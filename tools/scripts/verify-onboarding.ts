import { pool } from "../src/lib/db";
import { provisioning } from "../src/lib/provisioning";
import { ensureUserProfileSupportsTenantSlug } from "../src/lib/keycloakAdmin";
import { assert, decodeJwtPayload, loginAndGetToken } from "../src/lib/oidc";

/**
 * Phase 4 verification: full onboarding flow against the live stack.
 *   0. realm configuration (declarative user profile supports tenant_slug)
 *   1. POST /api/onboarding/signup (public, rate-limited)
 *   2. real PKCE login with the brand-new admin credentials
 *   3. tenant resolution via the JWT claim on /api/tenants/current
 *   4. negative cases: duplicate slug, reserved slug, weak password
 *
 * Requires the API running via nginx (http://localhost:8082).
 */
const BASE = "http://localhost:8082";

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function signup(body: Record<string, string>): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${BASE}/api/onboarding/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function main(): Promise<void> {
  // ---- 0. realm configuration (ops step, idempotent) ----
  await ensureUserProfileSupportsTenantSlug();

  // ---- happy path ----
  const slug = `onb-${randomSuffix()}`;
  const email = `admin-${randomSuffix()}@onboarding.test`;
  const password = "Onboarding-Test-1";

  // ---- happy path ----
  const created = await signup({
    companyName: "Onboarded Store",
    slug,
    adminEmail: email,
    adminPassword: password
  });
  assert(created.status === 201, "POST /api/onboarding/signup -> 201");
  assert(created.json["slug"] === slug, "response echoes the slug");

  const registry = await pool.query("SELECT id, status FROM public.tenants WHERE slug = $1", [slug]);
  assert(registry.rowCount === 1, "tenant registered in public.tenants");
  const schema = `t_${slug.replace(/-/g, "_")}`;
  const settings = await pool.query(`SELECT key FROM ${schema}.app_settings LIMIT 1`);
  assert((settings.rowCount ?? 0) >= 1, "tenant schema migrated + seeded");

  // ---- login as the newly created admin (real PKCE flow) ----
  const login = await loginAndGetToken(email, password);
  const claims = decodeJwtPayload(login.accessToken);
  assert(claims.tenant_slug === slug, "fresh user carries the tenant_slug claim");
  assert(
    (claims.realm_access as { roles: string[] }).roles.includes("tenant-admin"),
    "fresh user has the tenant-admin role"
  );

  const tenantResponse = await fetch(`${BASE}/api/tenants/current`, {
    headers: { Authorization: `Bearer ${login.accessToken}` }
  });
  const tenant = (await tenantResponse.json()) as { tenantId: string; slug: string };
  assert(tenantResponse.status === 200 && tenant.slug === slug, "tenant resolved immediately after signup");

  // ---- negative cases ----
  const duplicate = await signup({
    companyName: "Duplicate", slug, adminEmail: `other-${randomSuffix()}@onboarding.test`, adminPassword: password
  });
  assert(duplicate.status === 409, "duplicate slug -> 409");

  const reserved = await signup({
    companyName: "Reserved", slug: "api", adminEmail: `x-${randomSuffix()}@onboarding.test`, adminPassword: password
  });
  assert(reserved.status === 409, "reserved slug -> 409");

  const weak = await signup({
    companyName: "Weak", slug: `onb-${randomSuffix()}`, adminEmail: `w-${randomSuffix()}@onboarding.test`, adminPassword: "short"
  });
  assert(weak.status === 400, "weak password -> 400");

  // ---- cleanup: drop the test tenant + its Keycloak user ----
  await provisioning.dropTenant(slug, { force: true });
  const dropped = await pool.query("SELECT 1 FROM public.tenants WHERE slug = $1", [slug]);
  assert(dropped.rowCount === 0, "test tenant cleaned up");

  console.log("\nONBOARDING FLOW VERIFICATION PASSED");
  console.log(`note: Keycloak user ${email} remains in the dev realm (harmless)`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});

