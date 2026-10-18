import { ensureUserProfileSupportsTenantSlug } from "../src/lib/keycloakAdmin";
import { env } from "../src/lib/env";

/**
 * One-time (idempotent) realm configuration that realm-import cannot carry:
 * declares the `tenant_slug` attribute in the declarative user profile.
 * Required before onboarding signups work.
 */
async function main(): Promise<void> {
  if (!env.KEYCLOAK_ADMIN_PASSWORD) {
    console.error("KEYCLOAK_ADMIN_PASSWORD is required to configure the realm");
    process.exit(1);
  }
  await ensureUserProfileSupportsTenantSlug();
  console.log("Realm configuration verified.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
