import path from 'node:path';
import { randomUUID } from 'node:crypto';
import pgMigrate from 'node-pg-migrate';
import { pool, databaseUrl, quoteIdent } from '../src/lib/db';
import { assert } from '../src/lib/oidc';

const runner: typeof pgMigrate = typeof pgMigrate === 'function' ? pgMigrate : (pgMigrate as unknown as { runner: typeof pgMigrate }).runner;
const schema = `t_iso_migration_${randomUUID().replaceAll('-', '')}`;

async function main() {
  let created = false;
  try {
    await pool.query(`CREATE SCHEMA ${quoteIdent(schema)}`);
    created = true;
    const options = { databaseUrl: databaseUrl(), dir: path.resolve(__dirname, '../../packages/provisioning/migrations/tenant'), schema, migrationsSchema: schema, migrationsTable: 'pgmigrations', log: () => undefined };
    await runner({ ...options, direction: 'up', count: 3 });
    await pool.query(`INSERT INTO ${quoteIdent(schema)}.products(name,sku,price_cents,stock,unit_type,product_type)
      VALUES ('Legacy flour','LEGACY',100,12,'kg','consumable'),('Legacy haircut','SERVICE',100,4,'unit','service')`);
    await runner({ ...options, direction: 'up' });
    const result = await pool.query(`SELECT sku,stock::text FROM ${quoteIdent(schema)}.products ORDER BY sku`);
    assert(result.rows[0].stock === '12.000' && result.rows[1].stock === '0.000', 'legacy measured stock preserved, service neutralized');
    const history = await pool.query(`SELECT kind,delta::text,reason FROM ${quoteIdent(schema)}.stock_movements ORDER BY created_at`);
    assert(history.rows.length === 3 && history.rows.some((m) => m.kind === 'opening' && m.delta === '4.000') && history.rows.some((m) => m.kind === 'adjust' && m.delta === '-4.000'), 'legacy service value retained in explicit migration history');
    await runner({ ...options, direction: 'up' });
    assert(Number((await pool.query(`SELECT count(*) FROM ${quoteIdent(schema)}.stock_movements`)).rows[0].count) === 3, 're-running migrations does not duplicate opening records');
    let refused = false;
    try { await runner({ ...options, direction: 'down', count: 1 }); } catch { refused = true; }
    assert(refused, 'lossy history rollback refused');
    assert(Number((await pool.query(`SELECT count(*) FROM ${quoteIdent(schema)}.stock_movements`)).rows[0].count) === 3, 'failed rollback retains history');
    console.log('INVENTORY MIGRATION VERIFICATION PASSED');
  } finally {
    // Only the random schema created above is ever removed; no user tenant.
    if (created) await pool.query(`DROP SCHEMA ${quoteIdent(schema)} CASCADE`);
    await pool.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
