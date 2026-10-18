# syntax=docker/dockerfile:1
#
# One image for every environment (dev == prod): Angular is built once and
# served as static files by nginx. For hot reload during development, run the
# app on the host: pnpm --filter @retail/web start

# ---------- build ----------
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/env/package.json packages/env/
RUN pnpm install --frozen-lockfile || pnpm install

COPY apps/web apps/web
COPY packages/shared-types packages/shared-types
COPY packages/env packages/env
RUN pnpm --filter @retail/web build

# ---------- runtime (static files behind nginx) ----------
FROM nginx:alpine AS runtime
COPY apps/web/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist/web/browser /usr/share/nginx/html
EXPOSE 80

