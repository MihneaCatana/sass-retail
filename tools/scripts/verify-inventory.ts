import { randomUUID } from 'node:crypto';
import { pool } from '../src/lib/db';
import { provisioning } from '../src/lib/provisioning';
import { assert, loginAndGetToken } from '../src/lib/oidc';
import type { Product, StockMovement, StockMovementPage } from '../../packages/shared-types/src';

const ROOT = 'http://localhost:8082/api';
const createdSlugs: string[] = [];
async function request(token: string, path: string, body?: unknown, method = body ? 'POST' : 'GET') {
  return fetch(`${ROOT}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function tenant() {
  const slug = `iso-stock-${randomUUID().slice(0, 8)}`;
  const email = `owner-${slug}@inventory.test`;
  const response = await fetch(`${ROOT}/onboarding/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyName: 'Inventory verification', slug, adminEmail: email, adminPassword: 'Inventory-Verify1' }) });
  assert(response.status === 201, 'fresh disposable tenant created');
  createdSlugs.push(slug);
  return { slug, ...(await loginAndGetToken(email, 'Inventory-Verify1')) };
}

async function main() {
  try {
    const a = await tenant();
    const b = await tenant();
    const token = a.accessToken;
    const input = { name: 'Measured stock', sku: 'MEASURED', priceCents: 1200, stock: 1.5, unitType: 'kg', productType: 'consumable' };
    const create = await request(token, '/products', input);
    assert(create.status === 201, 'fractional opening stock accepted');
    const product = await create.json() as Product;
    assert(product.stock === 1.5, 'opening balance preserved');
    const path = `/products/${product.id}`;
    const movementPath = `${path}/movements`;
    const consume = { kind: 'consume', quantity: 0.25, reason: 'Disposable integration test', idempotencyKey: randomUUID() };
    const response = await request(token, movementPath, consume);
    assert(response.status === 201, 'consumption accepted');
    const movement = await response.json() as StockMovement;
    assert(movement.before === 1.5 && movement.after === 1.25 && movement.delta === -0.25, '1.500 kg - 0.250 kg = 1.250 kg exactly');
    const replays = await Promise.all([request(token, movementPath, consume), request(token, movementPath, consume)]);
    const replayBodies = await Promise.all(replays.map((r) => r.json() as Promise<StockMovement>));
    assert(replays.every((r) => r.status === 201) && replayBodies.every((r) => r.id === movement.id), 'concurrent identical retries return original movement');
    assert((await request(token, movementPath, { ...consume, quantity: 0.5 })).status === 409, 'key reuse with changed intent conflicts');
    const additions = await Promise.all([0.1, 0.2].map((quantity) => request(token, movementPath, { kind: 'receive', quantity, reason: 'Concurrent receipts', idempotencyKey: randomUUID() })));
    assert(additions.every((r) => r.status === 201), 'concurrent receipts both succeed');
    const balance = await (await request(token, path)).json() as Product;
    assert(balance.stock === 1.55, 'concurrent receipts do not lose updates');
    assert((await request(token, movementPath, { ...consume, idempotencyKey: randomUUID(), quantity: 100 })).status === 409, 'negative stock prevented');
    assert((await request(token, movementPath, { ...consume, idempotencyKey: randomUUID(), quantity: 0.0001 })).status === 400, 'excess precision rejected');
    const reverse = { reason: 'Undo test consumption', idempotencyKey: randomUUID() };
    const reverseResponse = await request(token, `${movementPath}/${movement.id}/reverse`, reverse);
    const reversed = await reverseResponse.json() as StockMovement;
    assert(reverseResponse.status === 201 && reversed.after === 1.8 && reversed.reversalOf === movement.id, 'reversal appends compensating entry');
    assert((await request(token, `${movementPath}/${movement.id}/reverse`, { ...reverse, idempotencyKey: randomUUID() })).status === 409, 'double reversal prevented');
    assert((await request(token, path, { ...input, stock: 1.5, name: 'Stale edit' }, 'PUT')).status === 409, 'stale metadata edit cannot overwrite stock');
    assert((await request(token, path, { ...input, stock: 1.8, unitType: 'l' }, 'PUT')).status === 409, 'unit reinterpretation prevented');
    assert((await request(token, path, undefined, 'DELETE')).status === 409, 'history prevents product deletion');
    const historyResponse = await request(token, movementPath);
    const history = await historyResponse.json() as StockMovementPage;
    assert(history.total === 5 && history.movements.some((m) => m.id === movement.id && m.reversed), 'complete immutable history, without duplicate retries');
    assert((await request(b.accessToken, movementPath)).status === 404, 'tenant B cannot read tenant A history');
    assert((await request(b.accessToken, movementPath, { ...consume, idempotencyKey: randomUUID() })).status === 404, 'tenant B cannot mutate tenant A stock');
    const serviceInput = { ...input, sku: 'SERVICE', productType: 'service', unitType: 'unit', stock: 0 };
    assert((await request(token, '/products', { ...serviceInput, stock: 1 })).status === 400, 'new service cannot have stock');
    const service = await (await request(token, '/products', serviceInput)).json() as Product;
    assert((await request(token, `/products/${service.id}/movements`, { ...consume, idempotencyKey: randomUUID() })).status === 409, 'service movements rejected');
    assert((await request(token, '/products', { ...input, sku: 'PIECES', unitType: 'unit', stock: 1.5 })).status === 400, 'fractional pieces rejected');
    const member = await loginAndGetToken('demo-acme', 'DemoAcme-Dev1');
    assert((await request(member.accessToken, movementPath, { ...consume, idempotencyKey: randomUUID() })).status === 403, 'tenant-user cannot write movements');
    assert((await request(member.accessToken, `${movementPath}/${movement.id}/reverse`, reverse)).status === 403, 'tenant-user cannot reverse');
    // Verify a member may read history within their own workspace by using an
    // existing product ID, if their catalog has one. Never mutate that workspace.
    const memberProducts = await (await request(member.accessToken, '/products')).json() as { products: Product[] };
    if (memberProducts.products[0]) assert((await request(member.accessToken, `/products/${memberProducts.products[0].id}/movements`)).status === 200, 'tenant member reads own history');
    console.log('INVENTORY VERIFICATION PASSED');
  } finally {
    for (const slug of createdSlugs) await provisioning.dropTenant(slug);
    await pool.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
