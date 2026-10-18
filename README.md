# sass-retail

Multi-tenant SaaS application for SMBs (retail domain).

**Stack:** pnpm monorepo | Angular | Node.js + Express | PostgreSQL (schema-per-tenant) | Keycloak (IAM) | Docker

## Project structure

```
apps/
  api/                  Express backend (modular monolith)
  web/                  Angular frontend
packages/
  shared-types/         DTOs & enums shared between api and web
  env/                  Shared zod-validated environment
  provisioning/         Shared tenant lifecycle + migrations
infrastructure/
  docker-compose.yml    Dev stack: postgres, keycloak, api, web, nginx, migrations
  nginx/                Reverse proxy (TLS later, /api routing)
  keycloak/             Realm config as code (imported at startup)
  postgres/init/        Database bootstrap scripts
tools/
  scripts/              Tenant provisioning / migrations / verification scripts
docs/
  architecture.md       Architecture diagrams
```

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Create your .env (defaults match the dev compose file)
copy .env.example .env

# 3a. Run the full stack - the exact same images production runs
pnpm dev:up

# 3b. Or infra only + hot-reload apps on the host:
pnpm infra:up
pnpm --filter @retail/api dev
pnpm --filter @retail/web start
```

> **Dev == prod**: there are no dev Docker images or dev code paths. The same
> built image runs everywhere; only environment variables differ.

## Architecture

See [docs/architecture.md](docs/architecture.md) for diagrams of the system
topology, onboarding flow, authenticated request flow, and the database
security model.

## CI

GitHub Actions runs on every push/PR:

- **static**: typecheck, ESLint, unit tests (api vitest + web vitest), builds
- **integration**: boots the same Docker stack and runs `test:isolation`,
  `verify:auth`, `verify:onboarding`

## Onboarding (Phase 4)

New tenants can self-serve from the app (`/signup`): the public
`POST /api/onboarding/signup` provisions the tenant (schema + per-tenant role +
migrations + registry row), then creates the admin user in Keycloak with the
`tenant_slug` attribute and the `tenant-admin` role - the user signs in
immediately after.

One ops step is required after a fresh Keycloak database (idempotent - the
API refuses signup with a clear message until it has run):

```bash
pnpm --filter @retail/tools configure:keycloak
```

Verify the whole onboarding flow live (signup -> real PKCE login as the new
admin -> tenant resolution + negative cases):

```bash
pnpm --filter @retail/tools verify:onboarding
```

## Multi-tenancy (schema-per-tenant)

```bash
# provision a tenant manually (schema t_<slug>, migrations, registry, seed)
pnpm --filter @retail/tools provision acme "Acme Retail"

# apply pending migrations to all tenant schemas
pnpm --filter @retail/tools migrate:tenants

# verify cross-tenant isolation (incl. DB role enforcement)
pnpm --filter @retail/tools test:isolation
```

Tenant resolution comes from the verified JWT: users carry a `tenant_slug`
attribute in Keycloak (mapped into the token), validated by the API against
issuer + audience. Verify the whole auth chain:

```bash
pnpm --filter @retail/tools verify:auth
```

Seeded dev users: `demo-acme` / `DemoAcme-Dev1` (tenant acme),
`platform-admin` / `PlatformAdmin-Dev1`.

| Service | URL |
|---|---|
| App (via nginx) | http://localhost:8082 |
| API | http://localhost:3000/api/health |
| Keycloak | http://localhost:8081 (admin / PlatformAdmin-Dev1) |
| Postgres (host) | localhost:5433 |

> Host ports 5432/80 are commonly taken by other local projects, so the dev
> stack defaults to 5433 (postgres) and 8082 (nginx). Adjust via `.env`.

> Note: the Keycloak bootstrap admin (`KEYCLOAK_ADMIN*` in `.env`) is for the
> Keycloak container and ops tooling only - the API uses the scoped
> `retail-onboarding` service client (least privilege, see TECH_DEBT.md).
