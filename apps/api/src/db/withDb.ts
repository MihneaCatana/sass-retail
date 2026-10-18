import type { PoolClient } from "pg";
import { getTenantContext } from "./context";
import { pool } from "./pool";

export type DbClient = PoolClient;

const SCHEMA_RE = /^[a-z_][a-z0-9_]{0,62}$/;

/** Quotes a schema/role identifier after strictly validating its charset. */
export function quoteIdent(identifier: string): string {
  if (!SCHEMA_RE.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: "${identifier}"`);
  }
  return `"${identifier}"`;
}

/**
 * Runs `fn` inside a dedicated transaction scoped to one schema AND one role:
 *   BEGIN;
 *   SET LOCAL search_path TO <schema>, public;
 *   SET LOCAL ROLE <schema>_app;        -- per-tenant DML-only role (DB-003)
 *   ... COMMIT;
 *
 * - `SET LOCAL` reverts automatically at transaction end — even on errors or
 *   crashes — so neither the schema nor the role can leak into the next request.
 * - The per-tenant role has rights on ITS schema only: even a SQL injection
 *   inside a tenant transaction cannot read another tenant's data.
 * - The connecting role (`POSTGRES_APP_USER`) is NOINHERIT: without the
 *   explicit SET ROLE it has no tenant privileges at all.
 * - `public` stays on the path for shared platform reference data.
 */
async function withSchemaDb<T>(schema: string, fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path TO ${quoteIdent(schema)}, public`);
    // Tenant transactions switch to the per-tenant role; platform queries on
    // `public` run as the connecting app role (registry reads only).
    if (schema !== "public") {
      await client.query(`SET LOCAL ROLE ${quoteIdent(`${schema}_app`)}`);
    }
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // connection already broken — release below is still safe
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Tenant-scoped transaction. Schema/role come from the tenant context (never caller-supplied). */
export function withTenantDb<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const { schema } = getTenantContext();
  return withSchemaDb(schema, fn);
}

/** Platform (cross-tenant) transaction against the `public` schema. Audit-logged callers only. */
export function withPlatformDb<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  return withSchemaDb("public", fn);
}
