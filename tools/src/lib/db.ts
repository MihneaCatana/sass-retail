import { Pool } from "pg";
import { env } from "./env";

/**
 * Tools connect as the migrate role: schema owner, DDL allowed. The API never
 * uses these credentials (it gets the DML-only app role, see DB-003).
 */
export const pool = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  user: env.POSTGRES_MIGRATE_USER,
  password: env.POSTGRES_MIGRATE_PASSWORD,
  max: 5
});

export function databaseUrl(): string {
  return `postgres://${encodeURIComponent(env.POSTGRES_MIGRATE_USER)}:${encodeURIComponent(
    env.POSTGRES_MIGRATE_PASSWORD
  )}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`;
}

const SCHEMA_RE = /^[a-z_][a-z0-9_]{0,62}$/;

/** Quotes a schema/role identifier after strictly validating its charset. */
export function quoteIdent(identifier: string): string {
  if (!SCHEMA_RE.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: "${identifier}"`);
  }
  return `"${identifier}"`;
}
