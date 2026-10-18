// Environment defaults for unit tests. Individual tests can override with
// vi.stubEnv (config/env.test.ts does exactly that for the failure paths).
process.env.POSTGRES_APP_PASSWORD ??= "test-app-password";
process.env.POSTGRES_MIGRATE_PASSWORD ??= "test-migrate-password";
process.env.KEYCLOAK_ADMIN_PASSWORD ??= "test-keycloak-admin-password";
process.env.JWT_ISSUER_URL ??= "http://localhost:8082/realms/retail";
process.env.JWT_JWKS_URL ??= "http://localhost:8081/realms/retail/protocol/openid-connect/certs";
