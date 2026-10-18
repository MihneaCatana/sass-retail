# Backlog Tickets (open work)

Actionable tickets for remaining work. Phase 6 items reference their
`TECH_DEBT.md` IDs; fix the debt, then mark both done.

---

## TICKET-101 — First business module: products (Phase 5)
- **Type:** feature · **Phase:** 5 · **Status:** open
- **Goal:** The reference implementation of a tenant-scoped domain module;
  all future modules copy this shape.
- **Scope:**
  - Tenant migration `0001_products.sql` in `packages/provisioning`
    (products table in every tenant schema, via `migrateAllTenants`).
  - Repository (`withTenantDb`, parameterized SQL only), service layer,
    REST routes: CRUD `/api/products` (+ list with pagination/filter).
  - Shared DTO types in `packages/shared-types`.
  - Angular lazy-loaded `products` feature with list + edit views,
    wired through the auth interceptor.
- **Acceptance criteria:**
  - CRUD works end-to-end for a logged-in tenant user.
  - `test:isolation` extended: tenant B cannot see/create/modify tenant A's
    products; app DB role still cannot touch foreign schemas.
  - Unit tests for service layer; `pnpm -r typecheck && pnpm lint` clean.

## TICKET-102 — Keycloak production mode + TLS (INFRA-002)
- **Type:** infrastructure · **Phase:** 6 · **Status:** open
- **Scope:** Keycloak `start` (production) with `KC_HOSTNAME`; TLS at nginx;
  realm `sslRequired: external`; `X-Forwarded-Proto https` for the realm path.
- **AC:** login + token issuance work over TLS; `start-dev` gone from compose.

## TICKET-103 — Secrets out of the repo (SEC-004)
- **Type:** security · **Phase:** 6 · **Status:** open
- **Scope:** All credentials via env/secret store; remove the dormant
  `retail-api` client secret and dev defaults from committed files;
  startup check rejects known dev defaults when `NODE_ENV=production`.
- **AC:** grep of the repo contains no real secrets; env guard test for prod defaults.

## TICKET-104 — Security headers + CSP on the SPA origin (INFRA-008)
- **Type:** security · **Phase:** 6 · **Status:** open
- **Scope:** CSP (script/style/img/connect-src allow-list), `nosniff`,
  `frame-ancestors 'none'`, HSTS once TLS exists; add headers in the web
  runtime nginx and outer nginx template; consider in-memory token storage
  in `angular-auth-oidc-client`.
- **AC:** headers verified via `curl -I` against the app origin; app still works.

## TICKET-105 — Bounded tenant cache + per-tenant rate limiting (SEC-005)
- **Type:** security/quality · **Phase:** 6 · **Status:** open
- **Scope:** Tenant-store cache only caches positive lookups (or LRU cap);
  generalize the onboarding rate limiter into per-tenant middleware for
  API routes.
- **AC:** negative lookups don't grow the cache (unit test); rate limit applies per tenant token.

## TICKET-106 — JWT algorithm pinning check (SEC-007)
- **Type:** security · **Status:** open — verify `algorithms: ["RS256"]`
  present in `authJwt.ts` (should already be done in TICKET-008; confirm or close).

## TICKET-107 — Bind dev ports to loopback (INFRA-009)
- **Type:** infrastructure · **Status:** open
- **Scope:** `"127.0.0.1:5433:5432"` etc. for postgres/keycloak in compose.
- **AC:** ports not reachable on non-loopback interfaces; stack still usable locally.

## TICKET-108 — Dependency scanning (INFRA-010)
- **Type:** quality · **Status:** open
- **Scope:** `pnpm audit` in CI (fail on high/critical); optionally Renovate.
- **AC:** CI job green on current tree; fails on an intentionally vulnerable pin in a branch.

## TICKET-109 — Email verification flow for onboarding
- **Type:** feature · **Phase:** 6 · **Status:** open
- **Scope:** SMTP for Keycloak (verify-email action instead of
  `emailVerified: true` in provisioning); welcome/invite email template.
- **AC:** new user gets verification email; login blocked until verified (configurable).

## TICKET-110 — Backups + tenant deletion operational story
- **Type:** infrastructure · **Phase:** 6 · **Status:** open
- **Scope:** pg_dump-based backup/restore scripts (platform + all tenant
  schemas); documented runbook for tenant offboarding via `provisioning.dropTenant`.
- **AC:** restore drill from backup succeeds; offboarding leaves no orphan
  schemas/roles/registry rows.

---

## Suggested order
1. **TICKET-101** (Phase 5 business module - unblocks all product work)
2. TICKET-104, 105, 107 (cheap hardening)
3. TICKET-108, 106
4. TICKET-102, 103 (production deployment prerequisites)
5. TICKET-109, 110
