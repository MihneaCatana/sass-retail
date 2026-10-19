# Backlog Tickets (open work)

Actionable tickets for remaining work. Phase 6 items reference their
`TECH_DEBT.md` IDs; fix the debt, then mark both done.

---

## TICKET-101 — First business module: products (Phase 5)
- **Type:** feature · **Phase:** 5 · **Status:** done (2026-10-19)
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
- **Outcome:** delivered as the reference module — `products.repo.ts`
  (withTenantDb, parameterized SQL), `products.service.ts` (zod validation,
  pagination clamping, domain errors: 400/404/409), `products.routes.ts`
  (reads for tenant members, mutations gated to `tenant-admin`);
  `0002_products` tenant migration applied to every schema by
  `migrateAllTenants`; web `/app/products` list (search + pagination) and
  create/edit forms (Signal Forms, price entered in major units, stored as
  cents); `test:isolation` extended (B sees none of A's products, cross-read
  denied) and a new `verify:products` e2e script (full CRUD as a fresh
  tenant admin + role negatives).

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
- **Type:** security · **Phase:** 6 · **Status:** done (2026-10-18)
- **Outcome:** headers enforced in `apps/web/nginx-spa.conf` (single
  enforcement point, see TECH_DEBT.md INFRA-008 for the rationale);
  HSTS deferred until TLS (TICKET-102); in-memory token storage evaluated
  and deferred (library defaults to sessionStorage; in-memory migration
  needs a live browser regression pass). Remaining: none until TICKET-102.

## TICKET-105 — Bounded tenant cache + per-tenant rate limiting (SEC-005)
- **Type:** security/quality · **Phase:** 6 · **Status:** done (2026-10-18)
- **Outcome:** tenant cache is positive-lookups-only + LRU-capped at 1,000
  entries (`tenantStore.ts`); `tenantRateLimit` middleware buckets by the
  verified `tenant_slug` claim and is applied to `/api/me` and `/api/tenants`
  (300 req/min/tenant). Distributed rate limiting (multi-instance) stays in
  TECH_DEBT as a scaling note.

## TICKET-106 — JWT algorithm pinning check (SEC-007)
- **Type:** security · **Status:** done (2026-10-18)
- **Outcome:** verified the ticket was NOT already satisfied in TICKET-008
  (the pin was missing) and implemented `algorithms: ["RS256"]` in
  `authJwt.ts`.

## TICKET-107 — Bind dev ports to loopback (INFRA-009)
- **Type:** infrastructure · **Status:** done (2026-10-18)
- **Outcome:** all host-published ports in compose bound to `127.0.0.1`
  (postgres 5433, Keycloak 8081, api 3000, nginx 8082). Stack remains fully
  usable locally.
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
