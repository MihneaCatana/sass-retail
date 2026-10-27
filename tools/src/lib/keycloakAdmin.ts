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

/** Keycloak 25+ supplies the access-token subject via the built-in basic
 * scope. Attach it without rewriting the client or touching users/sessions. */
export async function ensureWebClientSubject(): Promise<void> {
  const token = await getBootstrapAdminToken();
  const headers = { Authorization: `Bearer ${token}` };
  const clientsResponse = await fetch(`${env.KEYCLOAK_URL}/admin/realms/retail/clients?clientId=retail-web`, { headers });
  const scopesResponse = await fetch(`${env.KEYCLOAK_URL}/admin/realms/retail/client-scopes`, { headers });
  if (!clientsResponse.ok || !scopesResponse.ok) throw new Error('Could not inspect web client subject configuration');
  const clients = await clientsResponse.json() as Array<{ id: string; clientId: string }>;
  const scopes = await scopesResponse.json() as Array<{ id: string; name: string }>;
  const client = clients.find((c) => c.clientId === 'retail-web');
  const basic = scopes.find((s) => s.name === 'basic');
  if (!client || !basic) throw new Error('retail-web client or built-in basic scope missing; no configuration changed');
  const url = `${env.KEYCLOAK_URL}/admin/realms/retail/clients/${client.id}/default-client-scopes`;
  const currentResponse = await fetch(url, { headers });
  if (!currentResponse.ok) throw new Error('Could not inspect existing web client scopes');
  const current = await currentResponse.json() as Array<{ id: string }>;
  if (current.some((scope) => scope.id === basic.id)) {
    console.log('Web client already has the basic subject scope.'); return;
  }
  const attached = await fetch(`${url}/${basic.id}`, { method: 'PUT', headers });
  if (!attached.ok) throw new Error(`Could not attach basic subject scope: ${attached.status}`);
  console.log('Attached the basic subject scope to retail-web. Existing users and sessions were preserved.');
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

  // Keycloak 26.1 dropped the /clients/{id}/secret subresource (GET and PUT
  // return 404). The secret is read from and written through the FULL client
  // representation instead — a partial PUT drops unspecified fields, so fetch
  // the complete representation first.
  const clientUrl = `${env.KEYCLOAK_URL}/admin/realms/retail/clients/${client.id}`;
  const repRes = await fetch(clientUrl, { headers });
  if (!repRes.ok) {
    throw new Error(`Keycloak client fetch failed: ${repRes.status}`);
  }
  const rep = (await repRes.json()) as { secret?: string; publicClient?: boolean };

  const needsSecret = rep.secret !== secret;
  // Self-heal a stale realm where the client was imported as public (no secret
  // exists) — the API authenticates with client_credentials, so the client
  // must be confidential.
  const needsConfidential = rep.publicClient === true;
  if (!needsSecret && !needsConfidential) {
    console.log("retail-onboarding client secret already matches the environment.");
    return;
  }

  const put = await fetch(clientUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify({ ...rep, publicClient: false, secret })
  });
  if (!put.ok) {
    throw new Error(`Keycloak client secret update failed: ${put.status}`);
  }
  console.log(
    needsConfidential
      ? "retail-onboarding client set confidential with the secret from the environment."
      : "retail-onboarding client secret set from the environment."
  );
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
