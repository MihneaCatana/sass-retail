import { Pool } from "pg";
import { env } from "../config/env";
import { logger } from "../shared/logger";

/**
 * Shared connection pool for ALL tenants (never one pool per schema).
 * Tenant scoping happens per transaction via `SET LOCAL search_path`
 * (see withDb.ts), so a single pool scales to hundreds of tenants.
 */
export const pool = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  // DML-only role: no DDL, no rights on other tenants' schemas (DB-003).
  user: env.POSTGRES_APP_USER,
  password: env.POSTGRES_APP_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

// Idle-client errors surface on the pool — log instead of crashing the process.
pool.on("error", (err) => {
  logger.error({ err }, "unexpected PostgreSQL pool error");
});
