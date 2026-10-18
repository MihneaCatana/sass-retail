# Architecture

Multi-tenant SaaS for SMBs (retail domain). Schema-per-tenant PostgreSQL, Keycloak IAM, Angular + Express, one Docker image per app in every environment.

## System overview

```mermaid
flowchart LR
    browser["Browser<br/>(Angular SPA + OIDC client)"]

    subgraph compose["docker compose (dev == prod images)"]
        nginx["nginx<br/>:8082 -> 80<br/>routes /, /api, /realms"]
        web["retail-web<br/>Angular static build<br/>(nginx + SPA fallback)"]
        api["retail-api<br/>Express 5 (bundled)"]
        kc["retail-keycloak<br/>realm: retail<br/>- tenants = tenant_slug attr<br/>- brute-force + pwd policy"]
        mig["migrations (one-shot)<br/>node dist/migrate.js<br/>platform + all tenant schemas"]
        db[("PostgreSQL 16")]
    end

    tools["Ops CLI (@retail/tools)<br/>provision / migrate / verify scripts"]

    browser -->|"HTTPS"| nginx
    nginx -->|"/ (static)"| web
    nginx -->|"/api"| api
    nginx -->|"/realms"| kc

    browser -->|"OIDC code + PKCE"| kc
    browser -->|"Bearer JWT<br/>GET /api/*"| api

    api -->|"validate JWT via JWKS<br/>(iss + aud)"| kc
    api -->|"Admin API:<br/>create tenant admin user"| kc
    api -->|"request path:<br/>retail_app (DML only)"| db
    api -->|"onboarding only:<br/>retail_migrate (DDL)"| db

    tools -->|"retail_migrate"| db
    mig -->|"retail_migrate"| db
    kc -->|"keycloak database"| db
```

## Components

| Component | Responsibility |
|---|---|
| **nginx** (outer) | Single origin: `/` -> SPA, `/api` -> API, `/realms` -> Keycloak. Sets `X-Forwarded-*` so the OIDC issuer is origin-relative (identical in every environment). |
| **retail-web** | Angular static build served by its own nginx (SPA fallback). OIDC: authorization code + PKCE, refresh tokens, bearer interceptor, route guards. |
| **retail-api** | Express 5 modular monolith. `authJwt` (JWKS/iss/aud) -> `tenantContext` -> business modules: `health`, `me`, `tenants`, `onboarding` (public signup). |
| **retail-keycloak** | IAM. Single realm `retail`; tenant membership = `tenant_slug` user attribute mapped into JWT claims. Realm-as-code in `infrastructure/keycloak/realm-export.json` (password policy + brute-force included). |
| **PostgreSQL** | `public` schema = platform data (`tenants` registry, `audit_log`, `platform_migrations`). One schema per tenant (`t_<slug>`) with a dedicated NOLOGIN role. |
| **migrations** | One-shot compose service (same API image): applies platform + all tenant schemas before the API starts. |
| **@retail/tools** | Ops CLI: provisioning, migrations, and the live verification scripts (`test:isolation`, `verify:auth`, `verify:onboarding`). |
| **@retail/provisioning** | Shared tenant-lifecycle core (schema + per-tenant role + migrations + registry), used by both the API onboarding module and the CLI. |

## Onboarding flow (public signup)

```mermaid
sequenceDiagram
    participant B as Browser (/signup)
    participant A as API
    participant K as Keycloak (Admin API)
    participant D as PostgreSQL (retail_migrate)

    B->>A: POST /api/onboarding/signup<br/>{companyName, slug, adminEmail, adminPassword}
    A->>A: zod validate + slug/reserved checks + rate limit (per IP)
    A->>D: slug free? (public.tenants)
    A->>K: admin token (bootstrap admin, cached)
    A->>K: email already used?
    A->>D: BEGIN; CREATE SCHEMA t_<slug>; CREATE ROLE t_<slug>_app; grants; COMMIT
    A->>D: node-pg-migrate (tenant migrations) + registry row + seed
    A->>K: create user (tenant_slug attr, tenant-admin role)
    Note over A,D: on user-creation failure: dropTenant (compensating cleanup)
    A-->>B: 201 {slug, name, adminEmail, tenantId}
    B->>K: login with the new credentials (code + PKCE)
    K-->>B: JWT with tenant_slug + tenant-admin
```

## Authenticated tenant request

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API
    participant K as Keycloak
    participant D as PostgreSQL

    B->>K: login (OIDC code + PKCE)
    K-->>B: tokens (claims: sub, tenant_slug, realm_access.roles)
    B->>A: GET /api/tenants/current (Authorization: Bearer)
    A->>K: JWKS signature check (cached) + iss/aud validation
    A->>A: req.auth = { sub, tenantSlug, roles }
    A->>D: tenantContext: registry lookup (cached 30s)
    A->>D: BEGIN; SET LOCAL search_path TO t_<slug>, public;<br/>SET LOCAL ROLE t_<slug>_app; ... COMMIT
    Note over D: SET LOCAL reverts on commit/rollback -<br/>no schema or role can leak between requests
    A-->>B: JSON
```

## Database security model (DB-003)

```mermaid
flowchart TB
    su["retail (bootstrap superuser)<br/>init scripts only"]
    mig["retail_migrate<br/>CREATEROLE, owns all t_* schemas<br/>tools + API onboarding pool only"]
    app["retail_app<br/>LOGIN, NOINHERIT<br/>SELECT on public.tenants/audit_log only"]

    r1["t_acme_app (NOLOGIN)<br/>DML on t_acme only"]
    r2["t_globex_app (NOLOGIN)<br/>DML on t_globex only"]
    s1[("t_acme schema")]
    s2[("t_globex schema")]

    su -->|"creates"| mig
    su -->|"creates"| app
    mig -->|"owns"| s1
    mig -->|"owns"| s2
    mig -->|"grants + ADMIN"| r1
    mig -->|"grants + ADMIN"| r2
    app -.->|"member of ALL tenant roles<br/>but privileges apply only via<br/>SET LOCAL ROLE inside a transaction"| r1
    app -.-> r2
    r1 -->|"DML"| s1
    r2 -->|"DML"| s2
```

Key properties:

- The API request path **never** holds tenant privileges outside a transaction (`retail_app` is NOINHERIT; tenant rights activate only via `SET LOCAL ROLE`, which reverts at transaction end).
- Even a SQL injection inside a tenant transaction cannot read another tenant's schema (proven by `pnpm --filter @retail/tools test:isolation`).
- The registry (`public.tenants`) and audit log are the only cross-tenant tables the app role can touch (SELECT / INSERT respectively).

## Dev/prod parity

One image per app is built once and runs everywhere; only environment variables differ (`JWT_ISSUER_URL`, `KEYCLOAK_URL`, DB credentials, `MIGRATIONS_DIR`). Hot reload happens on the host; the Docker stack always runs the production-like build.

## Known deferred hardening

See `TECH_DEBT.md` (Keycloak production mode, scoped onboarding client instead of bootstrap admin, distributed rate limiting, CSP/security headers, backups).

