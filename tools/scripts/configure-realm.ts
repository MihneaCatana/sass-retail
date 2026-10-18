import {
  ensureOnboardingClientSecret,
  ensureUserProfileSupportsTenantSlug
} from "../src/lib/keycloakAdmin";
import { env } from "../src/lib/env";

/**
 * One-time (idempotent) realm configuration that realm-import cannot carry:
 * declares the `tenant_slug` attribute in the declarative user profile, and
 * pins the `retail-onboarding` client secret to the value from the
 * environment (TICKET-103: the realm export ships without secrets).
 * Required before onboarding signups work.
 */
async function main(): Promise<void> {
  if (!env.KEYCLOAK_ADMIN_PASSWORD) {
    console.error("KEYCLOAK_ADMIN_PASSWORD is required to configure the realm");
    process.exit(1);
  }
  const onboardingSecret = env.KEYCLOAK_ONBOARDING_CLIENT_SECRET;
  if (!onboardingSecret) {
    console.error("KEYCLOAK_ONBOARDING_CLIENT_SECRET is required to configure the realm");
    process.exit(1);
  }
  await ensureUserProfileSupportsTenantSlug();
  await ensureOnboardingClientSecret(onboardingSecret);
  console.log("Realm configuration verified.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
