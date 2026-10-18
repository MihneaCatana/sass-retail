import { z } from "zod";

/**
 * Shared, zod-validated environment used by the API and operational tools.
 * The app (and every script) fails fast at startup on invalid configuration.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3000),

  // Postgres — two roles (DB-003): the API gets a DML-only app role; tools
  // (migrations, provisioning) use the migrate role which owns the schemas.
  // Each consumer validates the passwords it needs (see apps/api and tools).
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5433),
  POSTGRES_DB: z.string().default("retail"),
  POSTGRES_APP_USER: z.string().default("retail_app"),
  POSTGRES_APP_PASSWORD: z.string().optional(),
  POSTGRES_MIGRATE_USER: z.string().default("retail_migrate"),
  POSTGRES_MIGRATE_PASSWORD: z.string().optional(),
  // Container-level only (postgres + keycloak services in docker-compose).
  // The API and tools never use it, but it is declared here so the
  // production dev-default guard below can catch it leaking into prod.
  POSTGRES_PASSWORD: z.string().optional(),

  // IAM (Phase 3)
  JWT_ISSUER_URL: z.string().default("http://localhost:8082/realms/retail"),
  // Where the API fetches Keycloak's public keys (inside the docker network
  // this must bypass the public origin). Defaults to the public issuer.
  JWT_JWKS_URL: z.string().optional(),
  JWT_AUDIENCE: z.string().default("retail-api"),

  // Keycloak Admin API (onboarding, Phase 4): scoped service-account client
  // (INFRA-011) - only realm-management user roles, never the bootstrap admin.
  // The bootstrap admin is used ONLY by ops tooling (@retail/tools) for realm
  // configuration - the API never holds those credentials.
  KEYCLOAK_URL: z.string().default("http://localhost:8081"),
  KEYCLOAK_ADMIN: z.string().default("admin"),
  KEYCLOAK_ADMIN_PASSWORD: z.string().optional(),
  KEYCLOAK_ONBOARDING_CLIENT_ID: z.string().default("retail-onboarding"),
  KEYCLOAK_ONBOARDING_CLIENT_SECRET: z.string().optional(),

  // Where tenant migrations live (container: /app/migrations; host default
  // resolves relative to the api package working directory).
  MIGRATIONS_DIR: z.string().optional(),

  // Comma-separated list of allowed browser origins
  CORS_ORIGIN: z.string().default("http://localhost:4200,http://localhost:8082")
});

export type Env = z.infer<typeof envSchema>;

/**
 * TICKET-103 (SEC-004): credentials must never come from the repo. The repo
 * still needs *dev placeholder* values (.env.example, docker-compose fixtures,
 * CI), so instead of banning those strings everywhere, production startup
 * rejects any credential that matches a known dev default. Copying .env.example
 * to a production host then fails fast instead of silently deploying
 * well-known secrets.
 */
const KNOWN_DEV_DEFAULT_CREDENTIALS = new Set([
  "retail-dev-password",
  "retail-app-dev-password",
  "retail-migrate-dev-password",
  "admin-dev-password",
  "retail-api-dev-secret",
  "retail-onboarding-dev-secret"
]);

const CREDENTIAL_FIELDS = [
  "POSTGRES_PASSWORD",
  "POSTGRES_APP_PASSWORD",
  "POSTGRES_MIGRATE_PASSWORD",
  "KEYCLOAK_ADMIN_PASSWORD",
  "KEYCLOAK_ONBOARDING_CLIENT_SECRET"
] as const;

export function assertNoDevDefaultCredentials(parsed: Env): void {
  if (parsed.NODE_ENV !== "production") {
    return;
  }
  for (const field of CREDENTIAL_FIELDS) {
    const value = parsed[field];
    if (value === undefined || value === "") {
      // Missing credentials fail later, at the entrypoint's requireEnvVar.
      continue;
    }
    if (KNOWN_DEV_DEFAULT_CREDENTIALS.has(value)) {
      console.error(
        `${field} is set to a known development default. Refusing to start in ` +
          `production: real credentials must be provided out-of-band (SEC-004).`
      );
      process.exit(1);
    }
  }
}

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
     
    console.error("Invalid environment configuration:", JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }
  assertNoDevDefaultCredentials(parsed.data);
  return parsed.data;
}

export const env = loadEnv();
