import { randomUUID } from 'node:crypto';
import { pool } from '../src/lib/db';
import { provisioning } from '../src/lib/provisioning';
import { assert, loginAndGetToken } from '../src/lib/oidc';
import type { Product, Sale, SalesPerformance, StockMovementPage } from '../../packages/shared-types/src';

const ROOT = 'http://localhost:8082/api';
const slugs: string[] = [];
async function request(token: string, path: string, body?: unknown, method = body ? 'POST' : 'GET') {
  return fetch(`${ROOT}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function tenant() {
  const slug = `iso-sales-${randomUUID().slice(0, 8)}`; const email = `owner-${slug}@sales.test`;
  const response = await fetch(`${ROOT}/onboarding/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyName: 'Sales verification', slug, adminEmail: email, adminPassword: 'Sales-Verify1' }) });
  assert(response.status === 201, 'disposable sales workspace created'); slugs.push(slug);
  return (await loginAndGetToken(email, 'Sales-Verify1')).accessToken;
}
async function main() {
  try {
    const token = await tenant(); const other = await tenant();
    const input = { name: 'Measured sweets', sku: 'SWEET', priceCents: 101, stock: 2, unitType: 'kg', productType: 'endproduct' };
    const p = await (await request(token, '/products', input)).json() as Product;
    const ppath = `/products/${p.id}`;
    assert((await request(token, `${ppath}/costs`, { unitCostCents: 1, priceBasis: 'tax_exclusive', effectiveAt: '2020-01-01T00:00:00Z', source: 'estimate' })).status === 201, 'standard cost version created');
    const draftInput = { priceBasis: 'tax_exclusive', lines: [{ productId: p.id, quantity: 1, unitPriceCents: 101, discountCents: 1 }] };
    const draft = await (await request(token, '/sales', draftInput)).json() as Sale;
    assert(draft.status === 'draft' && draft.totalCents === 100, 'draft persisted exact discount');
    const sourceSales = await (await request(token, `/sales?productId=${p.id}`)).json() as { total: number; sales: Sale[] };
    assert(sourceSales.total === 1 && sourceSales.sales[0].id === draft.id, 'product-filtered sales drilldown uses tenant-scoped paging');
    const unrelatedSales = await (await request(token, `/sales?productId=${randomUUID()}`)).json() as { total: number };
    assert(unrelatedSales.total === 0, 'unrelated product filter excludes sales');
    assert((await request(token, ppath)).status === 200 && (await (await request(token, ppath)).json() as Product).stock === 2, 'draft does not reserve stock');
    const salePath = `/sales/${draft.id}`;
    assert((await request(other, salePath)).status === 404, 'sale isolation enforced');
    assert((await request(token, salePath, { ...draftInput, revision: 999 }, 'PUT')).status === 409, 'stale draft revision rejected');
    const complete = { revision: draft.revision, idempotencyKey: randomUUID() };
    const completions = await Promise.all([request(token, `${salePath}/complete`, complete), request(token, `${salePath}/complete`, complete)]);
    assert(completions.every((r) => r.status === 200), 'concurrent completion retries succeed');
    const sale = await completions[0].json() as Sale;
    assert(sale.lines[0].unitCostCents === 1 && sale.status === 'completed', 'completion snapshots standard cost');
    assert((await (await request(token, ppath)).json() as Product).stock === 1, 'completion deducts stock once');
    assert((await request(token, salePath, { ...draftInput, revision: sale.revision }, 'PUT')).status === 409, 'completed sale immutable');
    await request(token, ppath, { ...input, name: 'Renamed catalog', priceCents: 999, stock: 1 }, 'PUT');
    await request(token, `${ppath}/costs`, { unitCostCents: 90, priceBasis: 'tax_exclusive', effectiveAt: '2021-01-01T00:00:00Z', source: 'purchase' });
    const snapshot = await (await request(token, salePath)).json() as Sale;
    assert(snapshot.lines[0].name === 'Measured sweets' && snapshot.lines[0].unitPriceCents === 101 && snapshot.lines[0].unitCostCents === 1, 'catalog and cost edits preserve snapshot');
    const history = await (await request(token, `${ppath}/movements`)).json() as StockMovementPage;
    const movement = history.movements.find((m) => m.saleId === sale.id)!;
    assert(!!movement, 'sale owns stock ledger link');
    assert((await request(token, `${ppath}/movements/${movement.id}/reverse`, { reason: 'Unsafe generic undo', idempotencyKey: randomUUID() })).status === 409, 'sale stock cannot be reversed independently');
    const partial = { reason: 'Partial return', idempotencyKey: randomUUID(), lines: [{ saleLineId: sale.lines[0].id, quantity: 0.333, restock: true }] };
    assert((await request(token, `${salePath}/returns`, partial)).status === 200, 'partial return recorded');
    assert((await request(token, `${salePath}/returns`, partial)).status === 200, 'partial return retry idempotent');
    assert((await request(token, `${salePath}/cancel`, { reason: 'Double cancellation', idempotencyKey: randomUUID(), restock: true })).status === 409, 'full cancellation after partial return rejected');
    for (const quantity of [0.333, 0.334]) assert((await request(token, `${salePath}/returns`, { ...partial, idempotencyKey: randomUUID(), lines: [{ ...partial.lines[0], quantity }] })).status === 200, 'remaining fractional return accepted');
    const returned = await (await request(token, salePath)).json() as Sale;
    assert(returned.returnedCents === 100 && returned.status === 'returned', 'cumulative return rounding restores exact original amount');
    assert((await (await request(token, ppath)).json() as Product).stock === 2, 'restock returns exact original quantity');
    const report = await (await request(token, '/sales/performance')).json() as SalesPerformance;
    assert(report.netSalesCents === 0 && report.estimatedProfitCents === 0 && report.products[0].estimatedCostCents === 0, 'cumulative returned cost never exceeds original recognized cost');
    assert((await request(token, '/sales/performance?from=2026-02-30')).status === 400, 'invalid calendar range rejected');
    assert((await request(token, '/sales/performance?from=2026-02-02&to=2026-01-01')).status === 400, 'inverted report range rejected');
    const insufficient = await (await request(token, '/sales', { ...draftInput, lines: [{ ...draftInput.lines[0], quantity: 3, unitPriceCents: 999 }] })).json() as Sale;
    assert((await request(token, `/sales/${insufficient.id}/complete`, { revision: insufficient.revision, idempotencyKey: randomUUID() })).status === 409, 'overselling rejected');
    assert((await (await request(token, ppath)).json() as Product).stock === 2, 'failed sale rolls back stock');
    const service = await (await request(token, '/products', { ...input, name: 'Haircut', sku: 'SERVICE', unitType: 'unit', productType: 'service', stock: 0 })).json() as Product;
    const serviceDraft = await (await request(token, '/sales', { priceBasis: 'unspecified', lines: [{ productId: service.id, quantity: 1, unitPriceCents: 101, discountCents: 0 }] })).json() as Sale;
    const servicePath = `/sales/${serviceDraft.id}`;
    assert((await request(token, `${servicePath}/complete`, { revision: serviceDraft.revision, idempotencyKey: randomUUID() })).status === 200, 'service completes without stock');
    const cancel = { reason: 'Service correction', idempotencyKey: randomUUID(), restock: true };
    const cancelled = await (await request(token, `${servicePath}/cancel`, cancel)).json() as Sale;
    assert(cancelled.status === 'cancelled' && cancelled.returnedCents === 101 && !cancelled.returns[0].lines[0].restock, 'full cancellation never creates service stock');
    assert((await request(token, `${servicePath}/cancel`, cancel)).status === 200, 'full cancellation retry idempotent');
    const serviceHistory = await (await request(token, `/products/${service.id}/movements`)).json() as StockMovementPage;
    assert(serviceHistory.total === 0, 'service completion and cancellation create no stock movements');
    assert((await request(token, `/products/${service.id}`, { ...input, name: 'Haircut', sku: 'SERVICE', stock: 0, unitType: 'kg', productType: 'service' }, 'PUT')).status === 409, 'sale-linked service units cannot be reinterpreted');
    const costOnly = await (await request(token, '/products', { ...input, name: 'Cost only service', sku: 'COSTONLY', stock: 0, unitType: 'unit', productType: 'service' })).json() as Product;
    await request(token, `/products/${costOnly.id}/costs`, { unitCostCents: 10, priceBasis: 'tax_exclusive', effectiveAt: '2020-01-01T00:00:00Z', source: 'service' });
    assert((await request(token, `/products/${costOnly.id}`, { ...input, name: costOnly.name, sku: costOnly.sku, stock: 0, unitType: 'kg', productType: 'service' }, 'PUT')).status === 409, 'cost versions lock original unit and type');
    assert((await request(token, `/products/${costOnly.id}`, undefined, 'DELETE')).status === 409, 'cost history prevents product deletion with stable conflict');
    const damagedDraft = await (await request(token, '/sales', { ...draftInput, lines: [{ ...draftInput.lines[0], quantity: 1, unitPriceCents: 999 }] })).json() as Sale;
    const damagedPath = `/sales/${damagedDraft.id}`;
    const damaged = await (await request(token, `${damagedPath}/complete`, { revision: damagedDraft.revision, idempotencyKey: randomUUID() })).json() as Sale;
    assert((await request(token, `${damagedPath}/returns`, { reason: 'Damaged goods cannot restock', idempotencyKey: randomUUID(), lines: [{ saleLineId: damaged.lines[0].id, quantity: 1, restock: false }] })).status === 200, 'nonrestockable return recorded');
    assert((await (await request(token, ppath)).json() as Product).stock === 1, 'damaged return leaves consumed stock unchanged');
    const loss = await (await request(token, '/sales/performance')).json() as SalesPerformance;
    assert(loss.products.find((row) => row.productId === p.id)?.estimatedCostCents === 90 && loss.estimatedProfitCents === -90, 'nonrestockable returns retain cost as estimated loss');
    const member = await loginAndGetToken('demo-acme', 'DemoAcme-Dev1');
    assert((await request(member.accessToken, '/sales/performance')).status === 403, 'profit reporting admin only');
    assert((await request(member.accessToken, '/sales', draftInput)).status === 403, 'member cannot record sales');
    console.log('SALES VERIFICATION PASSED');
  } finally { for (const slug of slugs) await provisioning.dropTenant(slug); await pool.end(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
