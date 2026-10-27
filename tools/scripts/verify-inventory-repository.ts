import { randomUUID } from 'node:crypto';
import { pool } from '../src/lib/db';
import { provisioning } from '../src/lib/provisioning';
import { assert } from '../src/lib/oidc';

/** Real PostgreSQL transaction tests using disposable tenants and the API's
 * DML-only pool. This does not authenticate or bypass authentication in HTTP. */
async function main() {
  const slugs: string[] = [];
  const { createProductsRepo } = await import('../../apps/api/src/modules/products/products.repo');
  const { runWithTenantContext } = await import('../../apps/api/src/db/context');
  const { pool: apiPool } = await import('../../apps/api/src/db/pool');
  try {
    const slugA = `iso-ledger-${randomUUID().slice(0, 8)}`;
    const a = await provisioning.provisionTenant({ slug: slugA, name: 'Ledger A' }); slugs.push(slugA);
    const slugB = `iso-ledger-${randomUUID().slice(0, 8)}`;
    const b = await provisioning.provisionTenant({ slug: slugB, name: 'Ledger B' }); slugs.push(slugB);
    const repo = createProductsRepo();
    const inA = <T>(fn: () => Promise<T>) => runWithTenantContext({ tenantId: a.id, slug: a.slug, schema: a.schema, name: 'A', roles: ['tenant-admin'], userId: 'test:verified-actor' }, fn);
    const inB = <T>(fn: () => Promise<T>) => runWithTenantContext({ tenantId: b.id, slug: b.slug, schema: b.schema, name: 'B', roles: ['tenant-admin'] }, fn);
    const input = { name: 'Flour', sku: 'FLOUR', priceCents: 100, stock: 1.5, unitType: 'kg' as const, productType: 'consumable' as const };
    const p = await inA(() => repo.create(input, 'test:verified-actor'));
    const request = { kind: 'consume' as const, quantity: 0.25, reason: 'Test consumption', idempotencyKey: randomUUID() };
    const movement = await inA(() => repo.move(p.id, request, 'test:verified-actor'));
    assert(movement.before === 1.5 && movement.after === 1.25, 'exact measured consumption');
    const retries = await inA(() => Promise.all([repo.move(p.id, request, 'test:verified-actor'), repo.move(p.id, request, 'test:verified-actor')]));
    assert(retries.every((m) => m.id === movement.id), 'simultaneous retries are idempotent');
    const expectCode = async (fn: () => Promise<unknown>, code: string) => {
      let actual: unknown;
      try { await fn(); } catch (error) { actual = (error as { code: string }).code; }
      assert(actual === code, code);
    };
    await expectCode(() => inA(() => repo.move(p.id, { ...request, quantity: 0.5 }, 'test:verified-actor')), 'IDEMPOTENCY_CONFLICT');
    await inA(() => Promise.all([0.1, 0.2].map((quantity) => repo.move(p.id, { kind: 'receive', quantity, reason: 'Concurrent receipt', idempotencyKey: randomUUID() }, 'test:verified-actor'))));
    assert((await inA(() => repo.getById(p.id)))?.stock === 1.55, 'concurrent changes serialize without lost updates');
    await expectCode(() => inA(() => repo.move(p.id, { ...request, quantity: 99, idempotencyKey: randomUUID() }, 'test:verified-actor')), 'INSUFFICIENT_STOCK');
    const reversed = await inA(() => repo.reverse(p.id, movement.id, 'Correction', randomUUID(), 'test:verified-actor'));
    assert(reversed.after === 1.8 && reversed.reversalOf === movement.id, 'reversal appends exact inverse');
    await expectCode(() => inA(() => repo.reverse(p.id, movement.id, 'Again', randomUUID(), 'test:verified-actor')), 'MOVEMENT_ALREADY_REVERSED');
    await expectCode(() => inA(() => repo.update(p.id, input)), 'STOCK_MOVEMENT_REQUIRED');
    await expectCode(() => inA(() => repo.update(p.id, { ...input, stock: 1.8, unitType: 'l' })), 'PRODUCT_CLASSIFICATION_LOCKED');
    await expectCode(() => inA(() => repo.remove(p.id)), 'PRODUCT_HAS_HISTORY');
    assert((await inA(() => repo.movements(p.id, 1, 20))).total === 5, 'history contains opening and four changes exactly once');
    assert((await inB(() => repo.movements(p.id, 1, 20))).total === 0, 'foreign history inaccessible through tenant-scoped DML connection');
    await expectCode(() => inB(() => repo.move(p.id, { ...request, idempotencyKey: randomUUID() }, 'test:other-actor')), 'PRODUCT_NOT_FOUND');
    const service = await inA(() => repo.create({ ...input, sku: 'SERVICE', stock: 0, productType: 'service' }, 'test:verified-actor'));
    await expectCode(() => inA(() => repo.move(service.id, { ...request, idempotencyKey: randomUUID() }, 'test:verified-actor')), 'SERVICE_NOT_TRACKED');
    console.log('INVENTORY REPOSITORY VERIFICATION PASSED');
  } finally {
    await apiPool.end();
    for (const slug of slugs) await provisioning.dropTenant(slug);
    await pool.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
