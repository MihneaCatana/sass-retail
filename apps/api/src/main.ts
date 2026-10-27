import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env, requireEnvVar } from "./config/env";
import { logger } from "./shared/logger";
import { pool } from "./db/pool";
import { authJwt } from "./middleware/authJwt";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { tenantRateLimit } from "./middleware/rateLimit";
import { tenantContext } from "./middleware/tenantContext";
import { healthRouter } from "./routes/health";
import { meRouter } from "./routes/me";
import { onboardingRouter } from "./modules/onboarding/onboarding.routes";
import { tenantsRouter, platformTenantsRouter } from "./modules/tenants/tenants.routes";
import { productsRouter } from "./modules/products/products.routes";
import { productCostsRouter, salesRouter } from './modules/sales/sales.routes';
import { userRateLimit } from "./middleware/rateLimit";
import { requireModule } from "./middleware/requireModule";

export function createApp(): express.Express {
  const app = express();

  // Always behind the nginx reverse proxy (dev == prod): trust the first hop
  // so req.ip reflects the real client (used by the signup rate limiter).
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(","), credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger, redact: { paths: ["req.headers.authorization"] } }));

  // Phase 3: JWT auth middleware (populates req.auth — the only identity source).
  app.use("/api/health", healthRouter);
  // Public (rate-limited) tenant signup — no auth.
  app.use("/api/onboarding", onboardingRouter);
  // Authenticated routes. The per-tenant limiter (TICKET-105 / SEC-005)
  // buckets by the verified tenant_slug claim so one tenant cannot starve the
  // others; requests without a tenant pass the limiter and 401 at authJwt.
  const tenantApiRateLimit = tenantRateLimit({ windowMs: 60_000, max: 300 });
  app.use("/api/me", authJwt, tenantApiRateLimit, meRouter);
  app.use("/api/products", authJwt, tenantApiRateLimit, tenantContext, requireModule("inventory"), productsRouter);
  app.use('/api/products', authJwt, tenantApiRateLimit, tenantContext, requireModule("inventory"), productCostsRouter);
  app.use('/api/sales', authJwt, tenantApiRateLimit, tenantContext, requireModule("sales"), salesRouter);
  app.use("/api/tenants", authJwt, tenantApiRateLimit, tenantContext, tenantsRouter);
  // Platform (cross-tenant) endpoints, outside the tenantContext middleware:
  // platform admins are not linked to any tenant. The role middleware enforces
  // platform-admin; the limiter buckets by the verified user id (TICKET-111).
  app.use(
    "/api/platform/tenants",
    authJwt,
    userRateLimit({ windowMs: 60_000, max: 300 }),
    platformTenantsRouter
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function main(): void {
  // The API server needs: request path (app role), onboarding provisioning
  // (migrate role) and the scoped Keycloak onboarding client.
  requireEnvVar("POSTGRES_APP_PASSWORD");
  requireEnvVar("POSTGRES_MIGRATE_PASSWORD");
  requireEnvVar("KEYCLOAK_ONBOARDING_CLIENT_SECRET");

  const app = createApp();
  const server = app.listen(env.API_PORT, () => {
    logger.info(
      { nodeEnv: env.NODE_ENV, dbHost: `${env.POSTGRES_HOST}:${env.POSTGRES_PORT}` },
      `API listening on port ${env.API_PORT} (${env.NODE_ENV})`
    );
  });

  // Log — never silently swallow — asynchronous programming errors.
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "unhandled promise rejection");
  });
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "uncaught exception, shutting down");
    process.exit(1);
  });

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      logger.info({ signal }, "shutting down");
      server.close(() => {
        pool.end().finally(() => process.exit(0));
      });
    });
  }
}

// Only start the server when run directly (keeps main.ts importable for tests).
if (require.main === module) {
  main();
}

