import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env, requireEnvVar } from "./config/env";
import { logger } from "./shared/logger";
import { pool } from "./db/pool";
import { authJwt } from "./middleware/authJwt";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { tenantContext } from "./middleware/tenantContext";
import { healthRouter } from "./routes/health";
import { meRouter } from "./routes/me";
import { onboardingRouter } from "./modules/onboarding/onboarding.routes";
import { tenantsRouter } from "./modules/tenants/tenants.routes";

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
  // Authenticated routes.
  app.use("/api/me", authJwt, meRouter);
  app.use("/api/tenants", authJwt, tenantContext, tenantsRouter);

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

