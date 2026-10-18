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
 * TICKET-103 (SEC-004): the realm export ships WITHOUT client secrets — they
 * must never live in the repo. Keycloak auto-generates a secret for a
 * confidential client on import, so ops tooling pins the `retail-onboarding`
 * secret to the value from the environment — the exact value the API reads as
 * KEYCLOAK_ONBOARDING_CLIENT_SECRET. Idempotent: skips the write when the
 * current secret already matches.
 */
export async function ensureOnboardingClientSecret(secret: string): Promise<void> {
  const token = await getBootstrapAdminToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const listUrl = `${env.KEYCLOAK_URL}/admin/realms/retail/clients?clientId=retail-onboarding`;
  const list = await fetch(listUrl, { headers });
  if (!list.ok) {
    throw new Error(`Keycloak client lookup failed: ${list.status}`);
  }
  const clients = (await list.json()) as Array<{ id: string; clientId: string }>;
  const client = clients.find((c) => c.clientId === "retail-onboarding");
  if (!client) {
    throw new Error("retail-onboarding client not found in realm 'retail'");
  }

  const secretUrl = `${env.KEYCLOAK_URL}/admin/realms/retail/clients/${client.id}/secret`;
  const current = await fetch(secretUrl, { headers });
  if (!current.ok) {
    throw new Error(`Keycloak client secret lookup failed: ${current.status}`);
  }
  const currentSecret = ((await current.json()) as { value?: string }).value;
  if (currentSecret === secret) {
    console.log("retail-onboarding client secret already matches the environment.");
    return;
  }

  const put = await fetch(secretUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify({ type: "secret", value: secret })
  });
  if (!put.ok) {
    throw new Error(`Keycloak client secret update failed: ${put.status}`);
  }
  console.log("retail-onboarding client secret set from the environment.");
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
