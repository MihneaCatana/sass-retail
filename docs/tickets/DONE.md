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

## TICKET-111 — Platform-admin tenant registry view
- **Type:** feature · **Phase:** 6 · **Status:** done (2026-10-19)
- **What:** Platform admins can see every tenant created in the app.
  - `GET /api/platform/tenants` (API): mounted outside `tenantContext`
    (platform admins are tenantless by design), guarded by the new
    `requireRole("platform-admin")` middleware, user-bucketed via
    `userRateLimit` (by JWT `sub`, 300 req/min), and audit-logged
    (`platform.tenants.listed`). Backed by `listAllTenants()` in
    `tenantStore.ts` (read-only SELECT on `public.tenants` with the
    DML-only `retail_app` role).
  - `TenantSummary` DTO in `packages/shared-types` (single contract source).
  - Angular: lazy-lightweight `/platform/tenants` page (standalone
    `PlatformTenants` component) behind `authGuard` +
    `platformAdminGuard` (new guard that verifies the role via `/api/me`);
    a "View all tenants" link appears on the home card only for
    platform admins. Table shows name, slug, plan, status badge and
    created date, with loading/error/empty states and refresh.
- **Verified:** API 31/31 unit tests (new: `listAllTenants` mapping +
  empty registry, `requireRole` 401/403/allow, `userRateLimit` bucketing),
  web 6/6 unit tests (component happy path + 403 role error),
  `pnpm typecheck`, `pnpm lint`, `pnpm build` all clean.

**Refactor note (2026-10-19):** the UI was modernized per the official
`angular-developer` agent skill (installed in `.github/skills/`): manual
subscribe+signal plumbing replaced with `httpResource`, the signup form
migrated from ngModel to Signal Forms, `AuthService` moved to the `@Service`
decorator, file names aligned with the v20+ suffixless/hyphenated style
(`auth.ts`, `auth-guard.ts`, `role-guard.ts`, `auth-interceptor.ts`,
`Tenants`), `/signup` + `/platform/tenants` lazy-loaded via `loadComponent`,
shared DTOs (`Me`, `CurrentTenant`) moved to `@retail/shared-types`, and
tests rewritten to the zoneless Act/Wait/Assert pattern. Initial web bundle:
1.94 MB → ~403 kB (lazy `signup`/`tenants` chunks).

**Template split (2026-10-19):** every component moved from inline
`template:` strings to external `templateUrl` HTML files, following the
skill's unified-filename rule (`tenants.ts` / `tenants.html` /
`tenants.scss`): `app`, `signin`, `signup`, `tenants`. Verified live:
typecheck, 7/7 web unit tests, lint, and production build all green.

**Sidebar shell (2026-10-19):** fixed the bug where signed-in navigation
did nothing — the `<router-outlet>` was only rendered for unauthenticated
users, so authenticated pages had nowhere to render. The app is now a real
shell: unauthenticated → bare outlet (sign-in/signup); authenticated →
sidebar layout (`app-sidebar`, reusable, inputs + `signOut` output) with a
routed content outlet. The old home card became the routed `Home` feature
(`/home`, reads the new shared `IdentityStore` service holding the
`me`/`tenant` httpResources); a `signedInGuard` redirects signed-in users
from `/` to `/home`; the sidebar shows "All tenants" only for platform
admins (nav highlighting via the reusable `NavItem` component); the tenants
table now uses the reusable `StatusBadge`. Regression tests added:
signed-in shell renders + navigating to `/platform/tenants` lists tenants
(web suite now 9/9).

**Sidebar restyle + auth-screen fix (2026-10-19):** sidebar redesigned as a
full-height (`position: sticky; top: 0; height: 100vh`) white column with the
app's existing visual language (white background, `#e5e7eb` borders,
`#2563eb` active items and Sign out button, light hover states); collapses
to a normal top block under 720px. Also fixed a visual regression on the
sign-in screen: its centering/background came from the removed `.shell` in
`app.scss` — `signin.scss` now carries its own `.shell` (identical to
`signup.scss`) so both auth screens render identically.

**Silent auth handoff (2026-10-19):** the OIDC callback lands back on the
origin root, so for one tick the router was on `/` (with `?state=...`
params) before the auth state resolved — flashing the sign-in card before
the effect routed into `/app/home`. `IdentityStore` now exposes
`isAuthCheckComplete` (resolves when the initial `checkAuth()` settles,
regardless of outcome — a failed check never blocks the UI), and the
sign-in page renders a neutral "Signing you in…" splash (with spinner,
reduced-motion aware) instead of the card until then. Result: no content
flash during the callback → app-zone handoff; the user goes straight from
the splash to `/app/home` (or the restored deep link). Regression tests:
post-login redirect (default + restored deep link) and the splash state
(web suite 12/12).

**Tenant detail page (2026-10-19):** platform admins can drill into a
tenant from the registry list. API: `GET /api/platform/tenants/:slug`
(`platformTenantsRouter`, `requireRole("platform-admin")`, audit-logged as
`platform.tenant.viewed`) returns the registry entry regardless of status
plus the tenant's most recent audit entries (matched via
`details->>'slug'`, since `public.audit_log` carries no tenant column).
`TenantSummary` gained `updatedAt`; `TenantAuditEntry`/`TenantDetail` DTOs
live in `@retail/shared-types`. Web: route `/app/platform/tenants/:slug`
(lazy) renders the new `TenantDetail` page — registry facts (slug, schema,
plan, status badge, created/updated) and the audit table — with
`withComponentInputBinding()` binding the route param to a signal input;
list rows link into the detail page. Verified: API 35/35 unit tests
(store detail + audit lookups), web 15/15 (component + route-param
integration), typecheck/lint/build clean.

**Keycloak login polish (2026-10-19, impeccable):** CSS-only refinement of
the `retail` login theme against the real rendered `keycloak.v2` markup.
Fixed: dark-token leak (the stock head script forces `pf-v5-theme-dark` for
dark-preference users — palette reasserted, `color-scheme: light only`);
disabled submit state (Faded Sky + `wait` cursor per DESIGN.md); inline
validation copy (Ledger Red 0.85rem) and helper hints (Shelf Grey); font
stack pinned to `system-ui` (PatternFly's stack can resolve to an installed
Red Hat face); the card group now sits centered on the floor both axes like
the SPA shell (`safe center` so short viewports degrade without clipping);
input padding matched to the SPA metric (0.5rem x 0.75rem); checkbox
`accent-color` and secondary/link button variants themed for the other auth
pages (logout-confirm, reset-password). Verified: served CSS live from the
mounted theme dir, login page renders 200.




---

**Note (updated):** implementation through TICKET-015 was committed in
`4080c2f`. TICKET-104..107 are implemented and verified, ready to commit.
---

**Note:** all of the above is implemented but not yet committed (repo shows
only the initial commit). Commit per ticket with `TICKET-0xx:` prefixes
before starting TICKET-101+.
