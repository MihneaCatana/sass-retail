# TECH_DEBT.md

Known security & quality debt, deliberately deferred. Source: security audit of 2026-10-17 (SEC-001, the `AUTH_DISABLED` auth bypass, was fixed immediately — everything else lives here). Re-audit after clearing this list.

| ID | Severity | Title |
|---|---|---|
| ~~[DB-003](#db-003)~~ | ~~High~~ | **FIXED (2026-10-17)** — per-tenant DB roles + `SET LOCAL ROLE` |
| [INFRA-002](#infra-002) | High | Keycloak runs in `start-dev` mode, `sslRequired: none` |
| [SEC-004](#sec-004) | Medium | Dev credentials + dormant client secret committed to the repo |
| ~~[INFRA-008](#infra-008)~~ | ~~Medium~~ | **FIXED (2026-10-18)** — security headers + CSP enforced on the SPA origin |
| ~~[SEC-005](#sec-005)~~ | ~~Low~~ | **FIXED (2026-10-18)** — bounded positive-only tenant cache + per-tenant rate limiting |
| ~~[SEC-006](#sec-006)~~ | ~~Low~~ | **FIXED (2026-10-17)** — explicit 401 guard in `meRouter` |
| ~~[SEC-007](#sec-007)~~ | ~~Low~~ | **FIXED (2026-10-18)** — JWT algorithms pinned to `RS256` |
| ~~[INFRA-009](#infra-009)~~ | ~~Low~~ | **FIXED (2026-10-18)** — all dev ports bound to loopback |
| [INFRA-010](#infra-010) | Low | No dependency scanning in CI |

---

## DB-003 — API DB user owns the database (runtime DDL + cross-schema read) — ~~High~~ **FIXED (2026-10-17)**

~~The API and tools connected as the same schema-owning user; one SQL injection could read any tenant via a qualified name.~~

**Implemented fix:**
- `retail_migrate` (CREATEROLE, owns schemas/tables, tools-only credentials) and `retail_app` (the API's **NOINHERIT** connect role, no tenant privileges of its own — created by `infrastructure/postgres/init/02-roles.sh`).
- Provisioning creates a **NOLOGIN role per tenant** (`t_<slug>_app`) with `USAGE` + DML on *only* that tenant's schema (default privileges cover future tables/sequences).
- `withTenantDb` runs every tenant transaction as `BEGIN; SET LOCAL search_path …; SET LOCAL ROLE t_<slug>_app; …` — `SET LOCAL ROLE` reverts at transaction end, so even a SQL injection inside a tenant request cannot cross schemas.
- `retail_migrate` holds `ADMIN OPTION` on tenant roles (needed to drop them when a tenant is deleted).
- The API holds ONLY app-role credentials; tools hold ONLY migrate credentials (enforced at startup in each package).
- Proven by `pnpm --filter @retail/tools test:isolation`: app role denied direct access (42501), works inside its switched tenant, cross-tenant read denied *inside* the tenant role (42501).

**Residual note:** the API connect role is a member of all tenant roles (the API serves all tenants); compromising the API *process* still yields all tenants — the boundary protects against injection/logic bugs inside requests, not against full API-process compromise.

## INFRA-002 — Keycloak `start-dev` + `sslRequired: none` — High (for any non-dev deployment)

`infrastructure/docker-compose.yml` (`command: ["start-dev", "--import-realm"]`) and `infrastructure/keycloak/realm-export.json` (`"sslRequired": "none"`). Fine for localhost; must not survive to production — dev-grade IdP means login pages/auth codes over HTTP.

**Fix (Phase 6):** switch to `start` with `KC_HOSTNAME` + TLS at nginx (`X-Forwarded-Proto https`), set `sslRequired: "external"` for production, and add a startup/config check that refuses dev defaults in prod.

## SEC-004 — Dev credentials + dormant client secret in the repo — Medium

`infrastructure/keycloak/realm-export.json`: `retail-api` client `secret` (line ~83 — the API never uses it; the client is a dormant confidential client), `platform-admin` password (~98), `demo-acme` password (~122). Compose defaults repeat the passwords. `.env` itself is correctly gitignored.

**Fix:** remove the `secret` field from `retail-api` (or make it a pure "audience" bearer-only-style config); prod credentials must come from a secret store with a startup check rejecting known dev defaults when `NODE_ENV=production`.

## INFRA-008 — No security headers on the Angular origin — ~~Medium~~ **FIXED (2026-10-18)**

~~The SPA (served by the web runtime nginx and proxied by the outer nginx) has no CSP, `frame-ancestors`, `X-Content-Type-Options`, or HSTS.~~

**Implemented fix:** security headers enforced in `apps/web/nginx-spa.conf` — the single enforcement point (duplicated headers at the outer nginx layer can make browsers reject or intersect policies unpredictably). Applied: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, CSP (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`) with `always` so they apply to SPA-fallback 404s too. API responses keep helmet's equivalents. HSTS deferred until TLS (INFRA-002). Token storage evaluated: the OIDC library defaults to sessionStorage (not localStorage); migrating to fully in-memory storage is deferred until the login flow can be regression-tested in a real browser.

## SEC-005 — Unbounded tenant-cache growth — ~~Low~~ **FIXED (2026-10-18)**

~~`apps/api/src/modules/tenants/tenantStore.ts` cached negative lookups too, growing unbounded.~~

**Implemented fix:** the tenant cache is now **positive-lookups-only** (misses always hit the DB — they are cheap and bounded by the registry's PK index) **and** capped by `CACHE_MAX_ENTRIES = 1_000` with LRU eviction (recency refreshed on hit). Paired with `tenantRateLimit` middleware on authenticated API routes, bucketed by the verified `tenant_slug` claim so one tenant cannot starve another even behind a shared IP. Proven by `apps/api/src/modules/tenants/tenantStore.test.ts` (misses don't grow the cache, LRU eviction works) and `apps/api/src/middleware/rateLimit.test.ts` (per-tenant buckets independent even from the same IP).

## SEC-006 — `meRouter` non-null assertion — ~~Low~~ **FIXED (2026-10-17)**

~~`apps/api/src/routes/me.ts` used `req.auth!`.~~ Replaced with an explicit 401 guard.

## SEC-007 — JWT algorithms not pinned — ~~Low~~ **FIXED (2026-10-18)**

~~`apps/api/src/middleware/authJwt.ts` — `jwtVerify` had no `algorithms` option.~~ Now pins `algorithms: ["RS256"]` in the `jwtVerify` options, so tokens claiming any other algorithm (HS256/`none` confusion) are rejected regardless of JWKS contents.

## INFRA-009 — Dev ports on all interfaces with weak defaults — ~~Low~~ **FIXED (2026-10-18)**

~~`infrastructure/docker-compose.yml`: postgres, Keycloak, api and nginx published on all interfaces with documented default passwords.~~ All host-facing ports are now loopback-only (`127.0.0.1:*`): postgres 5433, Keycloak 8081, api 3000, nginx 8082. The stack remains fully usable locally; any LAN/shared-host exposure now requires an explicit, reviewed change.

## INFRA-010 — No dependency scanning in CI — Low

No CI pipeline yet (Phase 6). When added: `pnpm audit --prod` gate + Dependabot/Renovate.

## INFRA-011 — ~~Onboarding uses the Keycloak bootstrap admin~~ **FIXED (2026-10-17)** — scoped service client

~~The onboarding module authenticated with the bootstrap admin (master realm, all-powerful).~~

**Implemented fix:**
- New realm-as-code client `retail-onboarding` (confidential, service accounts enabled) whose service account holds ONLY the realm-management roles `view-users`, `query-users`, `manage-users` (imported via `serviceAccountClientId` in realm-export.json).
- The API's onboarding module authenticates with client credentials against the retail realm (`KEYCLOAK_ONBOARDING_CLIENT_ID/SECRET`); the API container no longer holds any bootstrap-admin credentials (enforced by `requireEnvVar` at startup).
- Verified scopes live: user view/create + role mapping work; realm representation readable (filtered read, low sensitivity - see residual); client list returns empty; secret endpoints unreachable.
- Realm *configuration* (declarative user profile declaring `tenant_slug`) requires `manage-realm` and therefore belongs to ops tooling: `pnpm --filter @retail/tools configure:keycloak` (idempotent, runs in CI). The API additionally fails signup LOUDLY (503 with remediation message) if the attribute was dropped - verified live.

**Residuals (open):**
- The dev client secret lives in realm-export.json/.env - production moves it to a secret store.
- Users are created with `emailVerified: true` (no SMTP in dev) - production needs a verification-email flow.

---

Related planned hardening (Phase 6 roadmap, not listed above): per-tenant rate limiting, audit logging for platform/cross-tenant operations, CI pipeline (lint/test/typecheck/build), backup procedures, tenant subdomain routing hardening.
