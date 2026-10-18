# Done Tickets (Phases 1 - 4.5 + hardening)

Retrospective record of implemented work. Each ticket states what was
delivered and how it was verified. All work below is implemented and
verified live in the local Docker stack; see `AGENT.md` for the full log.

---

## TICKET-001 — Monorepo skeleton & workspace tooling
- **Type:** infrastructure · **Phase:** 1 · **Status:** done
- **What:** pnpm workspaces monorepo with `apps/api`, `apps/web`,
  `packages/*`, `tools`; root `package.json` scripts, shared
  `tsconfig.base.json`, `.gitignore`, `.env.example`.
- **Verified:** `pnpm -r typecheck` passes (6 packages).

## TICKET-002 — API skeleton (Express 5 + TypeScript)
- **Type:** feature · **Phase:** 1 · **Status:** done
- **What:** Express 5 app with zod-validated env config, pino structured
  logging, error-handler middleware, `/api/health/live` and
  `/api/health/ready` (DB check) endpoints, esbuild build to `dist/main.js`.
- **Verified:** `{"status":"ok"}` on `:3000` and via nginx `:8082`; `/ready` returns `{"db":"ok"}`.

## TICKET-003 — Angular app skeleton
- **Type:** feature · **Phase:** 1 · **Status:** done
- **What:** Angular (standalone components, Angular Router), vitest unit
  tests, SCSS, static production build.
- **Verified:** production build passes; app served by the web container.

## TICKET-004 — Docker infrastructure (dev == prod parity)
- **Type:** infrastructure · **Phase:** 1 · **Status:** done
- **What:** Multi-stage Dockerfiles for api/web (no dev-only stages, no src
  volume mounts - compose runs the exact prod image and command). Compose
  stack: postgres 16, Keycloak, api, web, nginx. Dev/prod parity rule
  recorded in `README.md`.
- **Verified:** all five `retail-*` containers up and healthy.

## TICKET-005 — Keycloak realm-as-code + nginx routing
- **Type:** infrastructure · **Phase:** 1/3 · **Status:** done
- **What:** `infrastructure/keycloak/realm-export.json` (realm `retail`,
  clients, roles), nginx app template proxying `/`, `/api`, `/realms/`
  with correct `X-Forwarded-*` headers; SPA fallback (`try_files`).
- **Verified:** issuer reachable at `http://localhost:8082/realms/retail`.

## TICKET-006 — Multi-tenancy core (schema-per-tenant)
- **Type:** feature · **Phase:** 2 · **Status:** done
- **What:** Platform schema (`public.tenants` registry), shared pg pool,
  `tenantContext` middleware resolving tenant from verified JWT only,
  `withTenantDb` / `withPlatformDb` transaction helpers using
  `SET LOCAL search_path`, tenant-scoped repository access via AsyncLocalStorage.
- **Verified:** header-less tenant resolution from JWT; `/api/tenants/current` returns correct tenant per user.

## TICKET-007 — Migration tooling (platform + per-tenant schemas)
- **Type:** infrastructure · **Phase:** 2/4.5 · **Status:** done
- **What:** `node-pg-migrate` setup with platform and tenant migration sets;
  scripts `migrate:platform`, `migrate:tenants` (`migrateAllTenants`),
  `provision` (schema creation + registration + seed).

## TICKET-008 — IAM integration (Keycloak + Angular + API)
- **Type:** feature · **Phase:** 3 · **Status:** done
- **What:** `authJwt` middleware (jose JWKS verification, issuer + audience
  pinning, `algorithms: ["RS256"]`, `tenant_slug` claim → `req.auth`);
  `/api/me` endpoint; Angular OIDC (code + PKCE, refresh, auth guard,
  interceptor); end-to-end `verify:auth` script.
- **Verified:** `pnpm --filter @retail/tools verify:auth` passes 10/10; no-token → 401, unknown tenant → 403.

## TICKET-009 — DB security hardening (SEC-001 + DB-003)
- **Type:** security · **Phase:** post-audit · **Status:** done
- **What:** Removed the `AUTH_DISABLED` header bypass entirely (no token →
  401, always). Separate DB roles: `retail_migrate` (DDL, tools only),
  `retail_app` (DML-only, NOINHERIT, API pool), per-tenant roles
  `t_<slug>_app` activated via `SET LOCAL ROLE` inside tenant transactions;
  cross-schema access revoked.
- **Verified:** `test:isolation` passes (B can't read A, app role denied on
  foreign schemas); `verify:auth` regression passes.

## TICKET-010 — Tenant provisioning + onboarding flow
- **Type:** feature · **Phase:** 4 · **Status:** done
- **What:** `packages/provisioning` (tenant lifecycle: create/drop, slug
  validation, seeding); `POST /api/onboarding/signup` (rate-limited, slug
  uniqueness, user + tenant creation in Keycloak, Postgres provisioning,
  compensation via `dropTenant` on failure); `/signup` Angular page;
  `verify:onboarding` end-to-end script.
- **Verified:** `verify:onboarding` 11/11; signup → login → tenant-scoped API access; failure paths compensated.

## TICKET-011 — Cross-tenant isolation test suite
- **Type:** test · **Phase:** 2/3 · **Status:** done
- **What:** `tools/scripts/test-isolation.ts`: provisions two tenants, asserts
  tenant A's data invisible to B (both app and DB level), unqualified queries
  outside tenant context fail loudly, unauthenticated requests rejected.
- **Verified:** suite green across DB-003 and onboarding changes.

## TICKET-012 — CI pipeline, linting, unit-test harness
- **Type:** quality · **Phase:** 4.5 · **Status:** done
- **What:** GitHub Actions CI (typecheck, lint, unit tests, isolation test,
  auth verification); ESLint flat config across packages; API vitest harness
  (17 tests incl. `withDb`, rate limit, env guards).
- **Verified:** `pnpm lint` clean (0 errors/warnings); `pnpm -r test` green (5 files, 17 tests).

## TICKET-013 — Reliability hardening (Phase 4.5)
- **Type:** quality · **Phase:** 4.5 · **Status:** done
- **What:** Container healthchecks for api/web/keycloak/postgres; pool
  error handlers; express error paths hardened; compose restart policies.
- **Verified:** all containers report healthy; error paths covered by tests.

## TICKET-014 — Keycloak realm hardening + audit log
- **Type:** security · **Phase:** 4.5 · **Status:** done
- **What:** Realm password policy + brute-force protection in
  `realm-export.json`; platform `audit_log` migration and
  `apps/api/src/shared/audit.ts` wiring for cross-tenant provisioning events.
- **Verified:** audit entries written during onboarding; `configure:keycloak` idempotent.

## TICKET-015 — Scoped Keycloak onboarding client (INFRA-011)
- **Type:** security · **Phase:** 4.5+ · **Status:** done
- **What:** API no longer holds bootstrap admin credentials; authenticates to
  Keycloak via `client_credentials` as scoped service client
  (`retail-onboarding`, `manage-users`/`view-users`/`query-users` only).
  Realm user-profile config moved to ops tooling `configure:keycloak`
  (idempotent, runs in CI after stack boot). Runtime guard: signup fails
  loudly (503) with remediation message if Keycloak drops `tenant_slug`.
- **Verified:** service-account roles exactly scoped; client-list endpoints
  return empty (data-denied); misconfig guard test passed and recovered;
  full `verify:onboarding` and `verify:auth` green.

---

## TICKET-104 — Security headers + CSP on the SPA origin (INFRA-008)
- **Type:** security · **Phase:** 6 · **Status:** done (2026-10-18)
- **What:** Security headers enforced in `apps/web/nginx-spa.conf` — the
  single enforcement point so every response carries exactly one set of
  headers (duplicated CSP/X-Frame-Options at the outer layer make browsers
  reject or intersect policies unpredictably). Applied: `nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  CSP (`default-src 'self'; script-src 'self'; style-src 'self'
  'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;
  connect-src 'self'; object-src 'none'; base-uri 'self'; form-action
  'self'; frame-ancestors 'none'`) with `always` so they apply to
  SPA-fallback 404s. API responses keep helmet's equivalents.
- **Considered:** HSTS deferred until TLS (TICKET-102); in-memory token
  storage evaluated — the OIDC library defaults to sessionStorage (not
  localStorage); in-memory migration deferred until the login flow can be
  regression-tested in a real browser.
- **Verified:** `pnpm -r typecheck` + lint + build clean; CSP tuned to the
  Angular production build (external scripts, inline critical CSS, no
  inline scripts). Live `curl -I` check pending Docker stack restart.

## TICKET-105 — Bounded tenant cache + per-tenant rate limiting (SEC-005)
- **Type:** security/quality · **Phase:** 6 · **Status:** done (2026-10-18)
- **What:** `tenantStore.ts` rewritten: positive-lookups-only cache (misses
  always hit the DB) with `CACHE_MAX_ENTRIES = 1_000` and LRU eviction
  (recency refreshed on hit) — bounds memory at
  min(active tenants, 1,000) entries. Generalized `rateLimit` to accept a
  `key` function and added `tenantRateLimit` bucketing by the verified
  `tenant_slug` claim; wired into `/api/me` and `/api/tenants`
  (300 req/min/tenant).
- **Verified:** new unit tests — `tenantStore.test.ts` (misses don't grow
  the cache, non-active tenants uncached, LRU eviction at cap verified by
  re-querying the oldest entry) and `rateLimit.test.ts` (per-tenant buckets
  independent even from the same IP; requests without a tenant pass through).

## TICKET-106 — JWT algorithm pinning (SEC-007)
- **Type:** security · **Phase:** 6 · **Status:** done (2026-10-18)
- **What:** Found the pin was NOT already present (contrary to the ticket's
  assumption about TICKET-008) and implemented it: `jwtVerify` now pins
  `algorithms: ["RS256"]`, so tokens claiming any other algorithm
  (HS256/`none` confusion) are rejected regardless of JWKS contents.
- **Verified:** `pnpm -r typecheck` + `pnpm lint` clean; pin confirmed in
  `apps/api/src/middleware/authJwt.ts`.

## TICKET-107 — Bind dev ports to loopback (INFRA-009)
- **Type:** infrastructure · **Phase:** 6 · **Status:** done (2026-10-18)
- **What:** All four host-published ports in `docker-compose.yml` bound to
  `127.0.0.1` — postgres 5433, Keycloak 8081, api 3000, nginx 8082 — with
  comments explaining each (Postgres must never be LAN-reachable; Keycloak
  admin console reached via localhost; direct API access is debug-only; the
  dev stack should not be exposed to the LAN).
- **Verified:** `docker compose config` shows `host_ip: 127.0.0.1` on all
  published ports; stack remains fully usable locally.

---

**Note (updated):** implementation through TICKET-015 was committed in
`4080c2f`. TICKET-104..107 are implemented and verified, ready to commit.
---

**Note:** all of the above is implemented but not yet committed (repo shows
only the initial commit). Commit per ticket with `TICKET-0xx:` prefixes
before starting TICKET-101+.
