import { Pool } from "pg";
import { env } from "../src/lib/env";
import { pool } from "../src/lib/db";
import { provisioning } from "../src/lib/provisioning";

const { provisionTenant, dropTenant, withSchemaDb } = provisioning;

/**
 * Cross-tenant isolation check (run against the dev database):
 *   - provisions two throwaway tenants (iso-a, iso-b)
 *   - writes a secret row in A's schema
 *   - asserts B sees NOTHING of it through the normal (unqualified) path
 *   - asserts A still sees exactly its own row
 *   - cleans up
 */
async function expectCount(client: import("pg").PoolClient, sql: string, params: string[], expected: number, label: string): Promise<void> {
  const result = await client.query(sql, params);
  if ((result.rowCount ?? 0) !== expected) {
    throw new Error(`ISOLATION FAILURE [${label}]: expected ${expected} rows, got ${result.rowCount}`);
  }
  console.log(`ok: ${label}`);
}

async function main(): Promise<void> {
  for (const slug of ["iso-a", "iso-b"]) {
    await dropTenant(slug, { force: true }); // clean slate (iso- slugs need no force)
  }

  const a = await provisionTenant({ slug: "iso-a", name: "Isolation A" });
  const b = await provisionTenant({ slug: "iso-b", name: "Isolation B" });
  console.log(`Provisioned ${a.schema} and ${b.schema}`);

  // Write a secret as tenant A
  await withSchemaDb(a.schema, async (client) => {
    await client.query("INSERT INTO app_settings (key, value) VALUES ($1, $2)", ["secret", JSON.stringify("visible-only-to-a")]);
  });

  // B must see nothing (unqualified query through its own search_path)
  await withSchemaDb(b.schema, (client) =>
    expectCount(client, "SELECT value FROM app_settings WHERE key = $1", ["secret"], 0, "B cannot see A's secret")
  );

  // A must see exactly its own row
  await withSchemaDb(a.schema, (client) =>
    expectCount(client, "SELECT value FROM app_settings WHERE key = $1", ["secret"], 1, "A sees its own secret")
  );

  // ---- DB-003 enforcement: the APP connect role (what the API connects as) ----
  const appPool = new Pool({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_APP_USER,
    password: env.POSTGRES_APP_PASSWORD,
    max: 2
  });

  // NOINHERIT + no direct grants: outside a role-switched transaction the app
  // role can touch NO tenant schema at all.
  try {
    await appPool.query(`SELECT * FROM ${a.schema}.app_settings`);
    throw new Error("ISOLATION FAILURE: app role read a tenant schema without SET ROLE");
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "42501") throw err;
    console.log("ok: app role has no direct tenant access (permission denied)");
  }

  // Inside a role-switched transaction the app role can work with ITS tenant…
  {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL search_path TO ${a.schema}, public`);
      await client.query(`SET LOCAL ROLE ${a.schema}_app`);
      await client.query("INSERT INTO app_settings (key, value) VALUES ($1, $2)", ["app-role-write", JSON.stringify("ok")]);
      await expectCount(client, "SELECT value FROM app_settings WHERE key = $1", ["secret"], 1, "app role works within its switched tenant");
      // …but a SQL injection inside that transaction still cannot reach other tenants.
      try {
        await client.query(`SELECT * FROM ${b.schema}.app_settings`);
        throw new Error("ISOLATION FAILURE: cross-tenant read succeeded inside tenant role");
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== "42501") throw err;
        console.log("ok: cross-tenant read blocked inside tenant role (permission denied)");
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  await appPool.end();

  // search_path must NOT leak between transactions: a fresh transaction on the
  // pool without SET LOCAL must not resolve A's unqualified table at all.
  // Expected: an "relation does not exist" error — NOT A's data.
  try {
    await pool.query("SELECT value FROM app_settings WHERE key = $1", ["secret"]);
    throw new Error("ISOLATION FAILURE: unqualified query outside tenant context unexpectedly resolved a table");
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "42P01") {
      throw err;
    }
    console.log("ok: no leakage outside tenant transactions (unqualified table does not resolve)");
  }

  await dropTenant("iso-a", { force: true });
  await dropTenant("iso-b", { force: true });
  console.log("\nISOLATION TEST PASSED");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
