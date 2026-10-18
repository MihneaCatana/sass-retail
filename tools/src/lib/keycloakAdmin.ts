import { env } from "./env";

/**
 * OPS-only Keycloak administration (bootstrap admin via admin-cli).
 * NEVER import this from the API - the API uses the scoped
 * `retail-onboarding` service client instead (see apps/api, INFRA-011).
 */

async function getBootstrapAdminToken(): Promise<string> {
  if (!env.KEYCLOAK_ADMIN_PASSWORD) {
    throw new Error("KEYCLOAK_ADMIN_PASSWORD is required for realm configuration");
  }
  const response = await fetch(`${env.KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: env.KEYCLOAK_ADMIN,
      password: env.KEYCLOAK_ADMIN_PASSWORD
    })
  });
  if (!response.ok) {
    throw new Error(`Keycloak admin token request failed: ${response.status}`);
  }
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

/**
 * Keycloak 26 silently drops user attributes that are not declared in the
 * realm's declarative user profile. Realm import does not carry the profile
 * config, so we ensure `tenant_slug` (admin-only view/edit) here - idempotent.
 */
export async function ensureUserProfileSupportsTenantSlug(): Promise<void> {
  const token = await getBootstrapAdminToken();
  const url = `${env.KEYCLOAK_URL}/admin/realms/retail/users/profile`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const get = await fetch(url, { headers });
  if (!get.ok) {
    throw new Error(`Keycloak user profile lookup failed: ${get.status}`);
  }
  const profile = (await get.json()) as { attributes?: Array<Record<string, unknown>> };
  if (profile.attributes?.some((a) => a["name"] === "tenant_slug")) {
    return;
  }

  profile.attributes = [
    ...(profile.attributes ?? []),
    {
      name: "tenant_slug",
      displayName: "Tenant slug",
      // Admin-only view/edit: users must never change their own tenant.
      permissions: { view: ["admin"], edit: ["admin"] },
      multivalued: false
    }
  ];
  const put = await fetch(url, { method: "PUT", headers, body: JSON.stringify(profile) });
  if (!put.ok) {
    throw new Error(`Keycloak user profile update failed: ${put.status}`);
  }
  console.log("Keycloak user profile now supports the tenant_slug attribute.");
}
