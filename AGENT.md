# AGENT.md

Guidance for AI agents (and humans) working in this repo. Keep this file **concise**; update the phase log after each phase.

## What this is

Multi-tenant SaaS for SMBs (retail domain). **Schema-per-tenant** PostgreSQL. Modular monolith.

## Stack

- **Monorepo**: pnpm workspaces - `apps/api` (Express 5 + TS), `apps/web` (Angular), `packages/shared-types` (shared DTOs), `packages/env` (zod env), `packages/provisioning` (tenant lifecycle)
- **DB**: PostgreSQL 16 - one schema per tenant (`t_<slug>`), platform tables in `public`; data access via Drizzle - tenant-scoped queries bind Drizzle to the `withTenantDb` transaction client, public-schema reads/writes use a pool-level instance (`db/drizzle.ts`); migrations stay on node-pg-migrate
- **IAM**: Keycloak (single realm `retail`; `tenant_slug` claim via protocol mapper + declarative user profile)
- **Docker**: one image per app, **identical in dev and prod** - only env vars differ
- **CI**: GitHub Actions - static (typecheck/lint/unit tests/build) + integration (docker stack + verification scripts)

## Iron rules

1. **Dev == prod**: no dev-only code paths, no dev-only Docker targets. Same image, same command. Hot reload happens on the host, not in containers.
2. **Tenant identity only from the verified JWT** (`tenant_slug` claim). Never from headers, query params, or request body. No auth bypasses, ever.
3. **All tenant DB access** goes through `withTenantDb()` (`BEGIN; SET LOCAL search_path ...; SET LOCAL ROLE <tenant>_app; ...`). Never set `search_path` or role manually.
4. **Least-privilege DB roles** (DB-003): the API request path uses the DML-only app role (`retail_app`, NOINHERIT); DDL (schemas, migrations, tenant roles) runs as `retail_migrate` only - isolated in the onboarding module + tools.
5. Shared API contracts live in `@retail/shared-types`; shared tenant lifecycle in `@retail/provisioning`. No duplicated DTOs or provisioning logic.
6. Env vars are validated by zod at startup; each entrypoint declares the credentials it needs via `requireEnvVar` (see apps/api).
7. Known deferred security/quality debt lives in `TECH_DEBT.md` - review it before starting each phase.

## Commands

```bash
pnpm install
pnpm infra:up            # postgres + keycloak + nginx only (for host-run apps)
pnpm dev:up              # full stack - builds and runs the SAME images as prod
pnpm --filter @retail/api dev    # hot-reload API on host (uses localhost:5433)
pnpm --filter @retail/web start  # hot-reload Angular on host
pnpm build | typecheck | lint | test

# Tenancy tooling (@retail/tools)
pnpm --filter @retail/tools provision <slug> "<name>" [plan]  # create tenant schema + registry row
pnpm --filter @retail/tools migrate:platform                  # apply public-schema migrations
pnpm --filter @retail/tools migrate:tenants                   # apply migrations to ALL tenant schemas
pnpm --filter @retail/tools test:isolation                    # cross-tenant isolation check
pnpm --filter @retail/tools verify:auth                       # full OIDC code+PKCE flow against Keycloak + API
pnpm --filter @retail/tools verify:onboarding                 # signup -> PKCE login as new admin -> tenant resolution
```

## Auth model (Phase 3)

- Keycloak realm `retail`, single realm, tenants = user attribute `tenant_slug` (protocol mapper -> JWT claim; the attribute is declared in the realm's declarative user profile, admin-only edit).
- Keycloak is proxied on the app origin (`/realms/` via nginx) so the OIDC issuer is **origin-relative** - the Angular app needs zero environment-specific config.
- API: `authJwt` middleware validates signature (JWKS via `jose`, cached), `iss` (`JWT_ISSUER_URL`) and `aud` (`retail-api`), then populates `req.auth` - the ONLY identity source.
- Roles in JWT `realm_access.roles`: `platform-admin`, `tenant-admin`, `tenant-user`.
- Seeded dev users: `demo-acme` / `DemoAcme-Dev1` (tenant acme), `platform-admin` / `PlatformAdmin-Dev1` (no tenant -> 403 on tenant routes). Passwords comply with the realm's password policy - keep new seeded users compliant too.
- Realm hardening as code: password policy + brute-force protection in realm-export.json.

## Onboarding (Phase 4)

`POST /api/onboarding/signup` (public, IP rate-limited): validates + checks slug/email availability, provisions the tenant (schema + per-tenant role + migrations + registry row), then creates the admin user in Keycloak with the `tenant_slug` attribute and `tenant-admin` role. Compensating cleanup on failure - no half-registered tenants. Audit entries land in `public.audit_log` (`tenant.created`).

## Structure notes

- Migrations live in `packages/provisioning/migrations/{platform,tenant}` as plain JS (node-pg-migrate). Platform = `public` schema; tenant = applied per tenant schema (tracked in each schema's `pgmigrations` table).
- Tenant schema naming: slug `acme-corp` -> schema `t_acme_corp`, per-tenant DB role `t_acme_app` (NOLOGIN, DML on that schema only).
- API tenant flow: `authJwt` -> `tenantContext` (resolves tenant, opens AsyncLocalStorage context) -> `withTenantDb()` in repositories.
- Deploy-time migrations run in the `migrations` compose service (`node dist/migrate.js`) before the API starts.

## Gotchas (learned in Phases 1-4.5)

- Docker only honors the **root** `.dockerignore` - never rely on per-app ones.
- Outer nginx resolves upstream names at startup; after recreating `api`/`web` containers, `docker restart retail-nginx`.
- pino "transports" (worker threads) don't survive esbuild bundling - use plain streams.
- Every new `packages/*` an app depends on must be added to that app's Dockerfile (`COPY <pkg>/package.json` + `COPY <pkg>`), or esbuild fails to resolve it in the image.
- Outside a tenant transaction, unqualified tenant tables DON'T resolve (error 42P01) - that's the isolation working, not a bug.
- `export ... from` re-exports are hoisted before statements by ESM->CJS transforms - never put dotenv.config() before a static re-export of a module that validates env at import time (see config/env.ts pattern).
- A shell session can leak env vars into `docker compose` interpolation - recreate containers (`--force-recreate`) after env changes.
- Keycloak re-imports the realm only when the DB is empty: to apply realm-export.json changes, drop + recreate the `keycloak` database, then restart the container. Imported users need firstName/lastName (or VERIFY_PROFILE blocks login) and policy-compliant passwords.
- Keycloak 26 silently drops user attributes not declared in the declarative user profile - the onboarding module self-heals this (`ensureUserProfileSupportsTenantSlug`).
- Keycloak issuer must include the public port - nginx template sets `X-Forwarded-Port ${NGINX_PUBLIC_PORT}`.
- Keep markdown files ASCII-only if you edit them via PowerShell (-replace/Set-Content corrupts non-ASCII characters).

## Phase log

- **Phase 1 - Skeleton (done)**: pnpm workspace, Express API skeleton (env validation, logging, health), Angular app, docker-compose (postgres/keycloak/nginx/api/web), Keycloak realm as code, nginx routing. Verified end-to-end; dev/prod parity enforced.
- **Phase 2 - Tenancy core (done)**: `packages/env` (shared zod env), pg pool, `AsyncLocalStorage` tenant context, `withTenantDb`/`withPlatformDb` (`SET LOCAL search_path` per transaction), `tenantContext` middleware, cached tenant registry store, `GET /api/tenants/current`, real `/ready` DB check, migration tooling (platform + per-tenant), provisioning + migrate-all scripts, isolation test suite - all verified live.
- **Phase 3 - IAM integration (done)**: Keycloak realm with `tenant_slug` mapper + `retail-api` audience mapper + seeded demo users; nginx proxies `/realms/` on the app origin; API `authJwt` (jose JWKS, iss+aud validation) -> `req.auth`; `GET /api/me`; authenticated-but-tenantless users -> 403, tampered tokens -> 401. Angular: `angular-auth-oidc-client` (code+PKCE, refresh tokens), auth service/interceptor/guard, sign-in UI. Verified live with a scripted full authorization-code+PKCE flow (10/10 assertions).
- **Post-audit hardening (done)**: SEC-001 `AUTH_DISABLED` auth bypass removed entirely; DB-003 role separation - `retail_migrate` (DDL/tools) vs `retail_app` (NOINHERIT connect role) with per-tenant NOLOGIN roles (`t_<slug>_app`) and `SET LOCAL ROLE` per transaction; isolation test extended to prove cross-schema access is denied even by qualified names. Remaining debt: `TECH_DEBT.md`.
- **Phase 4 - Onboarding flow (done)**: `packages/provisioning` (shared tenant-lifecycle core + migrations, used by API and tools); public `POST /api/onboarding/signup` (zod-validated, IP rate-limited, slug/email availability checks, compensating cleanup); Keycloak admin client creating the tenant admin user with `tenant_slug` attribute + `tenant-admin` role (self-heals the realm's declarative user profile); Angular `/signup` page + SPA nginx fallback. Verified live: `verify:onboarding` (signup -> PKCE login as the new admin -> tenant resolved; duplicate/reserved slug 409, weak password 400).
- **Phase 4.5 - Foundation hardening (done)**: GitHub Actions CI (static: typecheck/lint/unit tests/build; integration: full docker stack + all three verification scripts) + ESLint flat config; API unit test harness (vitest, 17 tests); deploy-time migrations (`migrations` compose service, api waits for completion); realm hardening (password policy + brute-force protection); `public.audit_log` + audit helper wired into onboarding; reliability fixes (pool error handler, unhandledRejection/uncaughtException, api+web healthchecks with `service_healthy` ordering). Verified live: all three verification scripts PASSED, audit row written, migrations service exit 0.
- **Platform console (2026-10-19)**: TICKET-111 - platform-admin tenant registry (list + detail with audit trail, API + web); `/app` shell refactor (guards, IdentityStore, Signal Forms signup, template split, silent auth handoff); Keycloak login theme polish. Angular agent skills vendored under `.github/skills`. See `docs/tickets/DONE.md` for the full log.
- **Phase 5 - First business module (done, 2026-10-19)**: products/inventory CRUD as the template for all domain modules (routes -> service -> repository via withTenantDb); reads for tenant members, mutations gated to tenant-admin; isolation test extended to products; `verify:products` e2e script.
- Phase 6 - Hardening: distributed rate limiting, security headers/CSP, backups, Keycloak production mode, scoped onboarding client, secret store (see TECH_DEBT.md).

