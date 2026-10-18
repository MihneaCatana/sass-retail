import { env } from "../../config/env";
import { logger } from "../../shared/logger";

/**
 * Minimal Keycloak Admin API client for tenant onboarding.
 *
 * Authenticates as the SCOPED service-account client `retail-onboarding`
 * (client credentials on the retail realm) holding only the realm-management
 * roles `view-users`, `query-users`, `manage-users` - never the bootstrap
 * admin (INFRA-011). Realm-level configuration (e.g. the declarative user
 * profile) is NOT possible with this client and belongs to ops tooling
 * (`pnpm --filter @retail/tools configure:keycloak`).
 *
 * Residual: the dev client secret lives in realm-export.json/.env; production
 * moves it to a secret store (TECH_DEBT.md).
 */


export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("Email already registered");
    this.name = "EmailAlreadyRegisteredError";
  }
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getServiceAccountToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  // Client credentials against the retail realm as the scoped service account.
  const response = await fetch(`${env.KEYCLOAK_URL}/realms/retail/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.KEYCLOAK_ONBOARDING_CLIENT_ID,
      client_secret: env.KEYCLOAK_ONBOARDING_CLIENT_SECRET ?? ""
    })
  });
  if (!response.ok) {
    throw new Error(`Keycloak onboarding client token request failed: ${response.status}`);
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  // Refresh 30s before actual expiry.
  tokenCache = { token: body.access_token, expiresAt: Date.now() + (body.expires_in - 30) * 1000 };
  return body.access_token;
}

function adminHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface CreateTenantAdminInput {
  email: string;
  password: string;
  companyName: string;
  tenantSlug: string;
}

// --- tenant_slug attribute guard (Keycloak 26) --------------------------------
// Custom user attributes are silently dropped unless declared in the realm's
// declarative user profile. Configuring the profile requires realm-management
// rights this scoped client does not have - it is done by ops tooling
// (`pnpm --filter @retail/tools configure:keycloak`). As a safety net we
// verify after creation that the attribute actually persisted, so a
// misconfigured realm fails LOUDLY instead of producing users without a
// tenant claim.

export class TenantAttributeNotPersistedError extends Error {
  constructor() {
    super(
      "Keycloak did not persist the tenant_slug attribute - " +
        "the realm's declarative user profile is not configured. " +
        "Run: pnpm --filter @retail/tools configure:keycloak"
    );
    this.name = "TenantAttributeNotPersistedError";
  }
}

/** True when a user with this email already exists in the retail realm. */
export async function emailExists(email: string): Promise<boolean> {
  const token = await getServiceAccountToken();
  const url = `${env.KEYCLOAK_URL}/admin/realms/retail/users?email=${encodeURIComponent(email)}&exact=true`;
  const response = await fetch(url, { headers: adminHeaders(token) });
  if (!response.ok) {
    throw new Error(`Keycloak user lookup failed: ${response.status}`);
  }
  const users = (await response.json()) as unknown[];
  return users.length > 0;
}

/**
 * Creates the tenant admin user in Keycloak with the `tenant_slug` attribute
 * (mapped into the JWT by the realm's protocol mapper) and the `tenant-admin`
 * realm role.
 */
export async function createTenantAdminUser(input: CreateTenantAdminInput): Promise<void> {
  const token = await getServiceAccountToken();

  const createResponse = await fetch(`${env.KEYCLOAK_URL}/admin/realms/retail/users`, {
    method: "POST",
    headers: adminHeaders(token),
    body: JSON.stringify({
      username: input.email,
      email: input.email,
      enabled: true,
      // No SMTP in the dev stack: mark verified so login works immediately.
      // Production should flip this and use a verification email flow.
      emailVerified: true,
      firstName: "Admin",
      lastName: input.companyName,
      attributes: { tenant_slug: [input.tenantSlug] },
      credentials: [{ type: "password", value: input.password, temporary: false }]
    })
  });

  if (createResponse.status === 409) {
    throw new EmailAlreadyRegisteredError();
  }
  if (!createResponse.ok) {
    throw new Error(`Keycloak user creation failed: ${createResponse.status}`);
  }

  const location = createResponse.headers.get("location");
  const userId = location?.split("/").pop();
  if (!userId) {
    throw new Error("Keycloak user creation returned no user id");
  }

  // Assign the tenant-admin realm role.
  const rolesResponse = await fetch(`${env.KEYCLOAK_URL}/admin/realms/retail/roles`, {
    headers: adminHeaders(token)
  });
  if (!rolesResponse.ok) {
    throw new Error(`Keycloak role lookup failed: ${rolesResponse.status}`);
  }
  const roles = (await rolesResponse.json()) as Array<{ id: string; name: string }>;
  const tenantAdmin = roles.find((r) => r.name === "tenant-admin");
  if (!tenantAdmin) {
    throw new Error("Realm role tenant-admin not found - realm import out of date?");
  }

  const mappingResponse = await fetch(
    `${env.KEYCLOAK_URL}/admin/realms/retail/users/${userId}/role-mappings/realm`,
    { method: "POST", headers: adminHeaders(token), body: JSON.stringify([tenantAdmin]) }
  );
  if (!mappingResponse.ok) {
    throw new Error(`Keycloak role mapping failed: ${mappingResponse.status}`);
  }

  // Guard (Keycloak 26): the declarative user profile silently drops
  // undeclared attributes. If tenant_slug did not persist, the user would
  // log in without a tenant claim - fail loudly instead (see docs/TECH_DEBT).
  const verifyResponse = await fetch(`${env.KEYCLOAK_URL}/admin/realms/retail/users/${userId}`, {
    headers: adminHeaders(token)
  });
  if (!verifyResponse.ok) {
    throw new Error(`Keycloak user verification failed: ${verifyResponse.status}`);
  }
  const createdUser = (await verifyResponse.json()) as {
    attributes?: Record<string, string[] | undefined>;
  };
  const persistedSlug = createdUser.attributes?.["tenant_slug"]?.[0];
  if (persistedSlug !== input.tenantSlug) {
    logger.error({ expected: input.tenantSlug, persisted: persistedSlug ?? null }, "tenant_slug attribute dropped");
    throw new TenantAttributeNotPersistedError();
  }
}
