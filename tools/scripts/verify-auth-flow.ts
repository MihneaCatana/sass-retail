import { pool } from "../src/lib/db";
import { assert, decodeJwtPayload, ISSUER, loginAndGetToken } from "../src/lib/oidc";

/**
 * End-to-end OIDC verification (run against the dev stack):
 * performs the SAME authorization-code + PKCE flow a browser does against
 * Keycloak, then validates the issued token and calls the API.
 *
 * Requires the API running via nginx (http://localhost:8082).
 */
async function main(): Promise<void> {
  // ---- happy path: tenant user ----
  const demo = await loginAndGetToken("demo-acme", "DemoAcme-Dev1");
  const claims = decodeJwtPayload(demo.accessToken);

  assert(claims.iss === ISSUER, "token issuer matches the nginx-proxied realm");
  assert(String(claims.aud).includes("retail-api"), "token audience includes retail-api");
  assert(claims.tenant_slug === "acme", "tenant_slug claim = acme (from user attribute mapper)");
  assert((claims.realm_access as { roles: string[] }).roles.includes("tenant-user"), "realm role tenant-user present");

  const tenantResponse = await fetch("http://localhost:8082/api/tenants/current", {
    headers: { Authorization: `Bearer ${demo.accessToken}` }
  });
  const tenant = (await tenantResponse.json()) as { tenantId: string; slug: string; name: string };
  assert(tenantResponse.status === 200, "GET /api/tenants/current with token -> 200");
  assert(tenant.slug === "acme", `API resolved tenant slug=acme (${tenant.name})`);

  const dbRow = await pool.query<{ id: string }>("SELECT id FROM public.tenants WHERE slug = $1", ["acme"]);
  assert(dbRow.rows[0]?.id === tenant.tenantId, "API tenantId matches the registry row");

  const meResponse = await fetch("http://localhost:8082/api/me", {
    headers: { Authorization: `Bearer ${demo.accessToken}` }
  });
  const me = (await meResponse.json()) as { sub: string };
  assert(meResponse.status === 200 && me.sub === claims.sub, "GET /api/me returns the JWT subject");

  // ---- negative: user without tenant claim -> 403 ----
  const platform = await loginAndGetToken("platform-admin", "PlatformAdmin-Dev1");
  const noTenant = await fetch("http://localhost:8082/api/tenants/current", {
    headers: { Authorization: `Bearer ${platform.accessToken}` }
  });
  assert(noTenant.status === 403, "authenticated user without tenant claim -> 403");

  // ---- negative: tampered token -> 401 ----
  const parts = demo.accessToken.split(".");
  parts[2] = parts[2].slice(0, -2) + (parts[2].endsWith("AA") ? "BB" : "AA");
  const tampered = await fetch("http://localhost:8082/api/tenants/current", {
    headers: { Authorization: `Bearer ${parts.join(".")}` }
  });
  assert(tampered.status === 401, "tampered token -> 401");

  console.log("\nOIDC FLOW VERIFICATION PASSED");
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});

