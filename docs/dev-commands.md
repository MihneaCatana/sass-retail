# Dev commands

Quick reference for the day-to-day commands in this repo. Architecture and
background live in [architecture.md](architecture.md); agent guidance in
[AGENT.md](../AGENT.md).

## Stack lifecycle

```bash
pnpm dev:up              # full stack: build + run the SAME images as prod
pnpm infra:up            # postgres + keycloak + nginx only (host-run apps)
pnpm infra:down          # stop api + web (host-run mode)
docker compose -f infrastructure/docker-compose.yml --env-file .env down
```

### ⚠️ Compose env-file quirk

When invoking `docker compose` directly with `-f infrastructure/docker-compose.yml`,
Compose resolves the default `.env` **next to the compose file** (in
`infrastructure/`), not from the repo root — required secrets
(`POSTGRES_APP_PASSWORD`, `POSTGRES_MIGRATE_PASSWORD`,
`KEYCLOAK_ONBOARDING_CLIENT_SECRET`) then fail interpolation with
`required variable ... is missing a value`.

Always pass `--env-file .env` explicitly when calling compose from the repo root:

```bash
docker compose -f infrastructure/docker-compose.yml --env-file .env ps
```

(`pnpm dev:up` / `pnpm infra:up` run from the repo root and work as-is.)

## Rebuild a single service after source edits

The `web` (and `api`) containers serve **static builds baked into their images**
("dev == prod": no dev targets, no hot reload inside containers). Source edits
only appear on :8082 after an image rebuild — a plain `restart` is not enough.

```bash
# rebuild + recreate only the web container
docker compose -f infrastructure/docker-compose.yml --env-file .env up -d --build web

# whole stack
pnpm dev:up
```

Verify what the container actually serves:

```bash
docker exec retail-web sh -c "grep -rl '<new copy>' /usr/share/nginx/html"
```

Browsers may cache the old `main-*.js` — hard-refresh with Ctrl+F5.

## Host hot-reload mode (no rebuild needed)

```bash
pnpm infra:up
pnpm --filter @retail/api dev     # hot-reload API on host (localhost:5433)
pnpm --filter @retail/web start   # hot-reload Angular on host
```

Use `http://localhost:4200` for the Angular dev server (HMR reflects edits
instantly). Note Keycloak/API redirect URLs are pinned to :8082, so auth
flows may need the container path for end-to-end testing.

## App URLs (dev)

| Service | URL |
|---|---|
| App (via nginx) | http://localhost:8082 |
| API health | http://localhost:3000/api/health |
| Keycloak | http://localhost:8081 (admin / PlatformAdmin-Dev1) |
| Postgres (host) | localhost:5433 |

## Quality gates

```bash
pnpm build | typecheck | lint | test          # whole monorepo
pnpm --filter @retail/web typecheck           # ng build --configuration development
pnpm --filter @retail/web test                # vitest, non-interactive
```

Non-interactive CI runs (avoids Angular's analytics prompt):
`$env:NG_CLI_ANALYTICS='false'; $env:CI='true';` before the command.

## Tenancy tooling

```bash
pnpm --filter @retail/tools provision <slug> "<name>" [plan]
pnpm --filter @retail/tools migrate:platform
pnpm --filter @retail/tools migrate:tenants
pnpm --filter @retail/tools test:isolation
pnpm --filter @retail/tools verify:auth
pnpm --filter @retail/tools verify:onboarding
pnpm --filter @retail/tools configure:keycloak   # one ops step after fresh Keycloak DB
```

Seeded dev users: `demo-acme` / `DemoAcme-Dev1` (tenant acme),
`platform-admin` / `PlatformAdmin-Dev1`.

## Impeccable (design skill)

Context records live in `apps/web/`: `PRODUCT.md` (product truth) and
`DESIGN.md` (visual system, sidecar `.impeccable/design.json`).

```powershell
# script location (Windows, no sh)
C:\Users\mihne\.agents\skills\impeccable\scripts\impeccable.cmd <command>
```

- `context [--target apps/web]` — load PRODUCT.md/DESIGN.md; run once per session
- `detect --json [--scope layout] <paths>` — mechanical design scan on changed UI
- `document` — regenerate DESIGN.md + sidecar from the current code
- Slash commands: `/impeccable init|document|layout|clarify|shape <surface>`
