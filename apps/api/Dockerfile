# syntax=docker/dockerfile:1
#
# One image for every environment (dev == prod). Only env vars differ.
# For hot reload during development, run the app on the host:
#   pnpm --filter @retail/api dev

# ---------- build ----------
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/env/package.json packages/env/
COPY packages/provisioning/package.json packages/provisioning/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile || pnpm install

COPY packages/shared-types packages/shared-types
COPY packages/env packages/env
COPY packages/provisioning packages/provisioning
COPY apps/api apps/api
RUN pnpm --filter @retail/api build

# ---------- runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# The API is fully bundled (esbuild) — no node_modules needed at runtime.
COPY --from=build /app/apps/api/dist dist
# Tenant migrations are read from disk by the onboarding provisioner.
COPY --from=build /app/packages/provisioning/migrations migrations
USER node

EXPOSE 3000
CMD ["node", "dist/main.js"]

