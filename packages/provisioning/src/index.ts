import path from "node:path";
import type { Pool, PoolClient } from "pg";
// node-pg-migrate ships CJS + named runner export; resolve robustly either way.
import pgMigrate from "node-pg-migrate";

const runner: typeof pgMigrate =
  typeof pgMigrate === "function" ? pgMigrate : (pgMigrate as unknown as { runner: typeof pgMigrate }).runner;

/** Tenant slugs: lowercase, hyphenated, 3..64 chars. Also the schema namespace. */
export const SLUG_RE = /^[a-z][a-z0-9-]{1,62}[a-z0-9]$/;

/** Subdomains that must never become tenant slugs. */
export const RESERVED_SLUGS = new Set([
  "api", "www", "app", "admin", "mail", "auth", "login", "signup",
  "keycloak", "platform", "console", "support", "status", "blog"
]);

const ID_RE = /^[a-z_][a-z0-9_]{0,62}$/;

/** Quotes a schema/role/table identifier after strictly validating its charset. */
export function quoteIdent(identifier: string): string {
  if (!ID_RE.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: "${identifier}"`);
  }
  return `"${identifier}"`;
}

/** Tenant slug -> schema name: `acme-corp` -> `t_acme_corp`. */
export function schemaNameFor(slug: string): string {
  if (!SLUG_RE.test(slug)) {
    throw new Error(`Invalid tenant slug "${slug}": must match ${SLUG_RE.source}`);
  }
  return `t_${slug.replace(/-/g, "_")}`;
}

export interface ProvisionTenantInput {
  slug: string;
  name: string;
  plan?: string;
}

export interface ProvisionTenantResult {
  id: string;
  slug: string;
  schema: string;
}

export interface ProvisionerDeps {
  /** Pool connected as the migrate role (schema owner, CREATEROLE). */
  pool: Pool;
  /** Connection string for node-pg-migrate (same migrate role). */
  databaseUrl: string;
  /** Absolute path to this package's migrations directory. */
  migrationsDir: string;
  /** The API's connect role, which receives membership in each tenant role. */
  appConnectRole: string;
}

export interface Provisioner {
  runPlatformMigrations(): Promise<void>;
  runTenantMigrations(schema: string): Promise<void>;
  migrateAllTenants(): Promise<Array<{ slug: string; schema: string }>>;
  provisionTenant(input: ProvisionTenantInput): Promise<ProvisionTenantResult>;
  dropTenant(slug: string, options?: { force?: boolean }): Promise<void>;
  withSchemaDb<T>(schema: string, fn: (client: PoolClient) => Promise<T>): Promise<T>;
}

/**
 * Tenant lifecycle core, shared by the ops CLI (@retail/tools) and the API's
 * onboarding module. MUST be instantiated with the migrate-role pool — the
 * DML-only app role cannot create schemas or roles.
 */
export function createProvisioner(deps: ProvisionerDeps): Provisioner {
  const { pool, databaseUrl, migrationsDir, appConnectRole } = deps;

  function log(msg: string): void {
     
    console.log(msg);
  }

  async function runPlatformMigrations(): Promise<void> {
    await runner({
      databaseUrl,
      dir: path.join(migrationsDir, "platform"),
      direction: "up",
      migrationsTable: "platform_migrations",
      schema: "public",
      log
    });
  }

  async function runTenantMigrations(schema: string): Promise<void> {
    await runner({
      databaseUrl,
      dir: path.join(migrationsDir, "tenant"),
      direction: "up",
      migrationsTable: "pgmigrations",
      migrationsSchema: schema,
      schema,
      log
    });
  }

  /**
   * Provisions a tenant:
   *   1. ensures platform migrations ran (public.tenants exists)
   *   2. creates the tenant schema owned by the migrate role (idempotent)
   *   3. creates the per-tenant NOLOGIN role and grants it THIS schema only
   *   4. grants membership of the tenant role to the API's connect role
   *   5. applies tenant migrations to that schema
   *   6. inserts the registry row (plain INSERT — duplicate slugs fail loudly)
   *   7. seeds defaults
   */
  async function provisionTenant(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
    await runPlatformMigrations();

    const schema = schemaNameFor(input.slug);
    const tenantRole = quoteIdent(`${schema}_app`);
    const connectRole = quoteIdent(appConnectRole);
    const migrateRole = quoteIdent("retail_migrate");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const exists = await client.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [schema]);
      if (exists.rowCount === 0) {
        await client.query(`CREATE SCHEMA ${quoteIdent(schema)}`);
      }

      // DB-003: one NOLOGIN role per tenant, with USAGE + DML on ITS schema
      // only. The API's connect role is NOINHERIT: it gains these privileges
      // only via `SET LOCAL ROLE` inside a transaction.
      const roleExists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [`${schema}_app`]);
      if (roleExists.rowCount === 0) {
        await client.query(`CREATE ROLE ${tenantRole} NOLOGIN`);
      }
      await client.query(`GRANT USAGE ON SCHEMA ${quoteIdent(schema)} TO ${tenantRole}`);
      await client.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${quoteIdent(schema)} TO ${tenantRole}`
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${migrateRole} IN SCHEMA ${quoteIdent(schema)}
         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${tenantRole}`
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${migrateRole} IN SCHEMA ${quoteIdent(schema)}
         GRANT USAGE, SELECT ON SEQUENCES TO ${tenantRole}`
      );
      await client.query(`GRANT ${tenantRole} TO ${connectRole}`);
      await client.query("COMMIT");
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }

    await runTenantMigrations(schema);

    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO public.tenants (slug, schema_name, name, plan, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id`,
      [input.slug, schema, input.name, input.plan ?? "free"]
    );

    await pool.query(
      `INSERT INTO ${quoteIdent(schema)}.app_settings (key, value)
       VALUES ('tenant.name', $1::jsonb)
       ON CONFLICT (key) DO NOTHING`,
      [JSON.stringify(input.name)]
    );

    return { id: inserted.rows[0].id, slug: input.slug, schema };
  }

  /**
   * Applies platform migrations, then tenant migrations to EVERY registered
   * tenant schema. Used by the deploy-time migration step and the ops CLI.
   */
  async function migrateAllTenants(): Promise<Array<{ slug: string; schema: string }>> {
    await runPlatformMigrations();
    const { rows } = await pool.query<{ slug: string; schema_name: string }>(
      "SELECT slug, schema_name FROM public.tenants ORDER BY created_at"
    );
    for (const row of rows) {
      await runTenantMigrations(row.schema_name);
      log(`Migrated tenant "${row.slug}" (schema ${row.schema_name})`);
    }
    return rows.map((r) => ({ slug: r.slug, schema: r.schema_name }));
  }

  /** Drops a tenant schema, its per-tenant role, and the registry row. Guarded: requires force for non-test slugs. */
  async function dropTenant(slug: string, options: { force?: boolean } = {}): Promise<void> {
    if (!slug.startsWith("iso-") && !options.force) {
      throw new Error(`Refusing to drop tenant "${slug}" without { force: true }`);
    }
    const schema = schemaNameFor(slug);
    await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schema)} CASCADE`);
    await pool.query(`DROP ROLE IF EXISTS ${quoteIdent(`${schema}_app`)}`);
    await pool.query("DELETE FROM public.tenants WHERE slug = $1", [slug]);
  }

  /** Runs `fn` inside a schema-scoped transaction (migrate role, full rights). */
  async function withSchemaDb<T>(schema: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL search_path TO ${quoteIdent(schema)}, public`);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }
  }

  return { runPlatformMigrations, runTenantMigrations, migrateAllTenants, provisionTenant, dropTenant, withSchemaDb };
}

