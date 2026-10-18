# TECH_DEBT.md

Known security & quality debt, deliberately deferred. Source: security audit of 2026-10-17 (SEC-001, the `AUTH_DISABLED` auth bypass, was fixed immediately — everything else lives here). Re-audit after clearing this list.

| ID | Severity | Title |
|---|---|---|
| ~~[DB-003](#db-003)~~ | ~~High~~ | **FIXED (2026-10-17)** — per-tenant DB roles + `SET LOCAL ROLE` |
| [INFRA-002](#infra-002) | High | Keycloak runs in `start-dev` mode, `sslRequired: none` |
| [SEC-004](#sec-004) | Medium | Dev credentials + dormant client secret committed to the repo |
| [INFRA-008](#infra-008) | Medium | No security headers (CSP etc.) on the Angular origin |
| [SEC-005](#sec-005) | Low | Unbounded tenant-cache growth from arbitrary slugs |
| ~~[SEC-006](#sec-006)~~ | ~~Low~~ | **FIXED (2026-10-17)** — explicit 401 guard in `meRouter` |
| [SEC-007](#sec-007) | Low | JWT algorithms not pinned |
| [INFRA-009](#infra-009) | Low | Dev ports bound to all interfaces with weak defaults |
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

## INFRA-008 — No security headers on the Angular origin — Medium

The SPA (served by the web runtime nginx and proxied by the outer nginx) has no CSP, `frame-ancestors`, `X-Content-Type-Options`, or HSTS. `angular-auth-oidc-client` stores tokens in browser storage by default — any XSS becomes token theft with refresh rights.

**Fix:** add a security-headers block to the web runtime nginx config and the outer nginx `location /` (CSP allow-list for scripts/styles/connect, `frame-ancestors 'none'`, HSTS once TLS exists). Evaluate the OIDC library's in-memory token storage.

## SEC-005 — Unbounded tenant-cache growth — Low

`apps/api/src/modules/tenants/tenantStore.ts` caches negative lookups too (`cache.set` runs for every distinct bogus slug) → unbounded heap growth = remote memory-DoS once public.

**Fix:** cache only positive results, or cap the map (LRU, few thousand entries). Pair with per-tenant rate limiting (Phase 6).

## SEC-006 — `meRouter` non-null assertion — ~~Low~~ **FIXED (2026-10-17)**

~~`apps/api/src/routes/me.ts` used `req.auth!`.~~ Replaced with an explicit 401 guard.

## SEC-007 — JWT algorithms not pinned — Low

`apps/api/src/middleware/authJwt.ts` — `jwtVerify` has no `algorithms` option. JWKS contents currently make this unexploitable, but pin it: `algorithms: ["RS256"]`.

## INFRA-009 — Dev ports on all interfaces with weak defaults — Low

`infrastructure/docker-compose.yml`: postgres (5433) and Keycloak (8081) bind `0.0.0.0` with documented default passwords. Fine locally; risky on shared/CI hosts.

**Fix:** bind to loopback: `"127.0.0.1:5433:5432"`, `"127.0.0.1:${KEYCLOAK_PORT:-8081}:8080"`.

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
