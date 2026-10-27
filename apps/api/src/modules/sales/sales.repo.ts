import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { withTenantDb, type DbClient } from '../../db/withDb';
import { products, stockMovements } from '../products/products.schema';
import { productCosts, saleOperations, saleProductLinks, saleReturns, sales } from './sales.schema';
import { SalesError, validDay, validProductFilter } from './sales.validation';
import { quantityToMillis, saleLineGrossCents, saleReturnAllocationCents } from '@retail/shared-types';
import type { CostVersion, CostVersionInput, PriceBasis, ProductPerformance, ProductType, Sale, SaleDraftInput,
  SaleLine, SaleReturn, SaleReturnInput, SalesPerformance, UnitType } from '@retail/shared-types';

type Db = NodePgDatabase;
type SaleRow = typeof sales.$inferSelect;
type ProductRow = typeof products.$inferSelect;
type ReturnRow = typeof saleReturns.$inferSelect;
export interface SaleQuery { page?: string; pageSize?: string; q?: string; status?: string; from?: string; to?: string; type?: string; productId?: string; }
const MAX_TOTAL = 9_000_000_000_000;
function millis(value: number): number {
  const m = quantityToMillis(value);
  if (m === undefined) throw new SalesError('INVALID_SALES_INPUT', 400);
  return m;
}
function boundedTotal(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_TOTAL) throw new SalesError('SALE_TOTAL_LIMIT', 400);
  return value;
}
function mapReturn(row: ReturnRow): SaleReturn {
  return { ...row, kind: row.kind as SaleReturn['kind'], createdAt: row.createdAt.toISOString() };
}
async function detail(db: Db, row: SaleRow, includeDraftAvailability = false): Promise<Sale> {
  const returns = await db.select().from(saleReturns).where(eq(saleReturns.saleId, row.id)).orderBy(asc(saleReturns.createdAt), asc(saleReturns.id));
  let lines = row.lines;
  if (includeDraftAvailability && row.status === 'draft' && row.lines.length) {
    const stockRows = await db.select({ id: products.id, stock: products.stock }).from(products)
      .where(inArray(products.id, [...new Set(row.lines.map((line) => line.productId))]));
    const available = new Map(stockRows.map((product) => [product.id, Number(product.stock)]));
    lines = row.lines.map((line) => ({ ...line, availableStock: available.get(line.productId) }));
  }
  return { ...row, status: row.status as Sale['status'], priceBasis: row.priceBasis as PriceBasis,
    createdAt: row.createdAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null,
    lines, returns: returns.map(mapReturn) };
}
async function lockedSale(db: Db, id: string): Promise<SaleRow> {
  const [row] = await db.select().from(sales).where(eq(sales.id, id)).for('update');
  if (!row) throw new SalesError('SALE_NOT_FOUND', 404);
  return row;
}
async function lockedProducts(db: Db, ids: string[]): Promise<Map<string, ProductRow>> {
  const rows = await db.select().from(products).where(inArray(products.id, [...new Set(ids)].sort())).orderBy(asc(products.id)).for('update');
  if (rows.length !== new Set(ids).size) throw new SalesError('PRODUCT_NOT_FOUND', 404);
  return new Map(rows.map((p) => [p.id, p]));
}
async function operation(db: Db, key: string, saleId: string, fingerprint: string): Promise<boolean> {
  await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(current_schema() || ':sale:' || ${key},0))`);
  const [previous] = await db.select().from(saleOperations).where(eq(saleOperations.idempotencyKey, key));
  if (!previous) return false;
  if (previous.saleId !== saleId || previous.fingerprint !== fingerprint) throw new SalesError('IDEMPOTENCY_CONFLICT');
  return true;
}
async function recordOperation(db: Db, key: string, saleId: string, fingerprint: string) {
  await db.insert(saleOperations).values({ idempotencyKey: key, saleId, fingerprint });
}
function checkActor(actor: string) { if (!actor?.trim()) throw new SalesError('MISSING_USER_SUBJECT', 401); }
function assertDraft(row: SaleRow, revision: number | undefined) {
  if (row.status !== 'draft') throw new SalesError('SALE_NOT_DRAFT');
  if (row.revision !== revision) throw new SalesError('SALE_REVISION_CONFLICT');
}
function makeLines(input: SaleDraftInput, catalog: Map<string, ProductRow>, previous: SaleLine[] = []): SaleLine[] {
  return input.lines.map((line) => {
    const product = catalog.get(line.productId)!;
    if (product.unitType === 'unit' && millis(line.quantity) % 1000 !== 0) throw new SalesError('WHOLE_UNITS_REQUIRED', 400);
    const old = previous.find((p) => p.productId === product.id);
    // Existing drafts retain their explicit price even if the catalog changed.
    const unchangedDraftPrice = old && old.unitPriceCents === line.unitPriceCents;
    if (!unchangedDraftPrice && line.unitPriceCents !== product.priceCents && !line.priceOverrideReason?.trim()) {
      throw new SalesError('PRICE_OVERRIDE_REASON_REQUIRED', 400);
    }
    const grossCents = boundedTotal(saleLineGrossCents(line.quantity, line.unitPriceCents));
    if (line.discountCents > grossCents) throw new SalesError('INVALID_SALES_INPUT', 400);
    return { ...line, priceOverrideReason: line.priceOverrideReason?.trim() ?? old?.priceOverrideReason ?? '',
      id: old?.id ?? randomUUID(), name: product.name, sku: product.sku,
      productType: product.productType as ProductType, unitType: product.unitType as UnitType,
      grossCents, totalCents: grossCents - line.discountCents, returnedQuantity: 0, returnedCents: 0,
      costVersionId: null, unitCostCents: null, costBasis: null };
  });
}
async function moveStock(db: Db, product: ProductRow, deltaMillis: number, actor: string,
  saleId: string, lineId: string, reference: string, returnId: string | null = null) {
  if (product.productType === 'service') return;
  const before = millis(Number(product.stock));
  const after = before + deltaMillis;
  if (after < 0) throw new SalesError('INSUFFICIENT_STOCK');
  if (after > 1_000_000_000) throw new SalesError('STOCK_LIMIT');
  await db.insert(stockMovements).values({ productId: product.id, kind: deltaMillis < 0 ? 'consume' : 'receive',
    delta: String(deltaMillis / 1000), before: String(before / 1000), after: String(after / 1000),
    unitType: product.unitType, reason: `Sale ${reference}${returnId ? ' return' : ''}`, actor,
    saleId, saleLineId: lineId, saleReturnId: returnId });
  await db.update(products).set({ stock: String(after / 1000), updatedAt: new Date() }).where(eq(products.id, product.id));
  product.stock = String(after / 1000);
}
function mapCost(row: typeof productCosts.$inferSelect): CostVersion {
  return { ...row, priceBasis: row.priceBasis as PriceBasis, source: row.source as CostVersion['source'],
    effectiveAt: row.effectiveAt.toISOString(), createdAt: row.createdAt.toISOString() };
}
function range(query: SaleQuery) {
  const from = validDay(query.from); const to = validDay(query.to);
  if (from && to && from > to) throw new SalesError('INVALID_SALES_INPUT', 400);
  return { from, to };
}
function dateWhere(column: typeof sales.createdAt | typeof sales.completedAt, from?: string, to?: string) {
  return and(from ? sql`(${column} at time zone 'Europe/Bucharest')::date >= ${from}::date` : undefined,
    to ? sql`(${column} at time zone 'Europe/Bucharest')::date <= ${to}::date` : undefined);
}

export function createSalesRepo() {
  return {
    async get(id: string): Promise<Sale> {
      return withTenantDb(async (client) => {
        const db = drizzle(client); const [row] = await db.select().from(sales).where(eq(sales.id, id));
        if (!row) throw new SalesError('SALE_NOT_FOUND', 404);
        return detail(db, row, true);
      });
    },
    async list(query: SaleQuery) {
      const { from, to } = range(query);
      validProductFilter(query.productId);
      const page = Math.min(100_000, Math.max(1, parseInt(query.page ?? '1', 10) || 1));
      const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '20', 10) || 20));
      const statuses = ['draft', 'completed', 'partially_returned', 'returned', 'cancelled', 'discarded'];
      if (query.status && !statuses.includes(query.status)) throw new SalesError('INVALID_SALES_INPUT', 400);
      const term = query.q?.trim().replace(/([\\%_])/g, '\\$1');
      return withTenantDb(async (client) => {
        const db = drizzle(client);
        const where = and(query.status ? eq(sales.status, query.status) : undefined,
          query.productId ? sql`exists (select 1 from ${saleProductLinks} where ${saleProductLinks.saleId} = ${sales.id} and ${saleProductLinks.productId} = ${query.productId})` : undefined,
          term ? or(ilike(sales.reference, `%${term}%`), ilike(sales.note, `%${term}%`)) : undefined,
          dateWhere(sales.createdAt, from, to));
        const rows = await db.select().from(sales).where(where).orderBy(desc(sales.createdAt), asc(sales.id))
          .limit(pageSize).offset((page - 1) * pageSize);
        const [{ total }] = await db.select({ total: count() }).from(sales).where(where);
        return { sales: await Promise.all(rows.map((row) => detail(db, row))), total, page, pageSize };
      });
    },
    async save(input: SaleDraftInput, actor: string, id?: string): Promise<Sale> {
      checkActor(actor);
      return withTenantDb(async (client) => {
        const db = drizzle(client); const previous = id ? await lockedSale(db, id) : undefined;
        if (previous) assertDraft(previous, input.revision);
        const catalog = await lockedProducts(db, input.lines.map((l) => l.productId));
        const lines = makeLines(input, catalog, previous?.lines);
        const totalCents = boundedTotal(lines.reduce((sum, l) => sum + l.totalCents, 0));
        const values = { priceBasis: input.priceBasis, note: input.note ?? '', lines, totalCents,
          revision: previous ? previous.revision + 1 : 1 };
        const saleId = id ?? randomUUID();
        const [row] = previous
          ? await db.update(sales).set(values).where(eq(sales.id, saleId)).returning()
          : await db.insert(sales).values({ ...values, id: saleId, reference: `S-${saleId}`, status: 'draft', actor }).returning();
        await db.delete(saleProductLinks).where(eq(saleProductLinks.saleId, saleId));
        await db.insert(saleProductLinks).values(lines.map((l) => ({ saleId, productId: l.productId })));
        return detail(db, row, true);
      });
    },
    async complete(id: string, revision: number, key: string, actor: string): Promise<Sale> {
      checkActor(actor);
      return withTenantDb(async (client) => {
        const db = drizzle(client); const fingerprint = JSON.stringify({ kind: 'complete', id, revision });
        const replay = await operation(db, key, id, fingerprint);
        const row = await lockedSale(db, id);
        if (replay) return detail(db, row);
        assertDraft(row, revision);
        const catalog = await lockedProducts(db, row.lines.map((l) => l.productId));
        const now = new Date(); const lines: SaleLine[] = [];
        for (const line of row.lines) {
          const product = catalog.get(line.productId)!;
          if (product.productType !== line.productType || product.unitType !== line.unitType) throw new SalesError('PRODUCT_CLASSIFICATION_CHANGED');
          const [cost] = await db.select().from(productCosts).where(and(eq(productCosts.productId, product.id), lte(productCosts.effectiveAt, now)))
            .orderBy(desc(productCosts.effectiveAt), desc(productCosts.createdAt), desc(productCosts.id)).limit(1);
          lines.push({ ...line, costVersionId: cost?.id ?? null, unitCostCents: cost?.unitCostCents ?? null,
            costBasis: cost?.priceBasis as PriceBasis ?? null });
          await moveStock(db, product, -millis(line.quantity), actor, id, line.id, row.reference);
        }
        const [completed] = await db.update(sales).set({ lines, status: 'completed', completedAt: now, revision: row.revision + 1 })
          .where(eq(sales.id, id)).returning();
        await recordOperation(db, key, id, fingerprint);
        return detail(db, completed);
      });
    },
    async discard(id: string, revision: number): Promise<Sale> {
      return withTenantDb(async (client) => {
        const db = drizzle(client); const row = await lockedSale(db, id); assertDraft(row, revision);
        const [discarded] = await db.update(sales).set({ status: 'discarded', revision: row.revision + 1 }).where(eq(sales.id, id)).returning();
        return detail(db, discarded);
      });
    },
    async returnSale(id: string, input: SaleReturnInput | { reason: string; idempotencyKey: string; restock: boolean }, actor: string): Promise<Sale> {
      checkActor(actor);
      return withTenantDb(async (client) => {
        const db = drizzle(client); const kind = 'lines' in input ? 'return' : 'cancel';
        const fingerprint = JSON.stringify({ kind, id, ...input });
        const replay = await operation(db, input.idempotencyKey, id, fingerprint);
        const row = await lockedSale(db, id);
        if (replay) return detail(db, row);
        if (!['completed', 'partially_returned'].includes(row.status)) throw new SalesError('SALE_NOT_RETURNABLE');
        if (kind === 'cancel' && row.lines.some((l) => l.returnedQuantity > 0)) throw new SalesError('SALE_PARTIALLY_RETURNED');
        const requested = 'lines' in input ? input.lines : row.lines.map((line) => ({ saleLineId: line.id,
          quantity: (millis(line.quantity) - millis(line.returnedQuantity)) / 1000, restock: input.restock && line.productType !== 'service' }));
        const catalog = await lockedProducts(db, row.lines.map((l) => l.productId));
        const returnId = randomUUID(); let totalCents = 0;
        const lines = row.lines.map((line) => ({ ...line }));
        const returnedLines = requested.map((request) => {
          const line = lines.find((l) => l.id === request.saleLineId);
          if (!line) throw new SalesError('SALE_LINE_NOT_FOUND', 404);
          const quantity = millis(request.quantity);
          if (quantity <= 0 || quantity + millis(line.returnedQuantity) > millis(line.quantity)) throw new SalesError('RETURN_QUANTITY_EXCEEDED');
          if (line.unitType === 'unit' && quantity % 1000 !== 0) throw new SalesError('WHOLE_UNITS_REQUIRED', 400);
          if (line.productType === 'service' && request.restock) throw new SalesError('SERVICE_NOT_TRACKED');
          const amountCents = saleReturnAllocationCents(line.totalCents, line.quantity, line.returnedQuantity, request.quantity);
          line.returnedQuantity = (millis(line.returnedQuantity) + quantity) / 1000;
          line.returnedCents += amountCents; totalCents += amountCents;
          return { ...request, amountCents };
        });
        // The return exists before movements that refer to it; the transaction
        // rolls both back if any stock invariant fails.
        await db.insert(saleReturns).values({ id: returnId, saleId: id, kind, reason: input.reason, actor,
          totalCents: boundedTotal(totalCents), lines: returnedLines });
        for (const request of returnedLines) {
          const line = lines.find((l) => l.id === request.saleLineId)!;
          if (request.restock && line.productType !== 'service') {
            await moveStock(db, catalog.get(line.productId)!, millis(request.quantity), actor, id, line.id, row.reference, returnId);
          }
        }
        const allReturned = lines.every((l) => millis(l.returnedQuantity) === millis(l.quantity));
        const [updated] = await db.update(sales).set({ lines, returnedCents: row.returnedCents + totalCents,
          status: kind === 'cancel' ? 'cancelled' : allReturned ? 'returned' : 'partially_returned', revision: row.revision + 1 })
          .where(eq(sales.id, id)).returning();
        await recordOperation(db, input.idempotencyKey, id, fingerprint);
        return detail(db, updated);
      });
    },
    async costs(productId: string): Promise<CostVersion[]> {
      return withTenantDb(async (client) => {
        const db = drizzle(client); const [p] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId));
        if (!p) throw new SalesError('PRODUCT_NOT_FOUND', 404);
        return (await db.select().from(productCosts).where(eq(productCosts.productId, productId))
          .orderBy(desc(productCosts.effectiveAt), desc(productCosts.createdAt))).map(mapCost);
      });
    },
    async addCost(productId: string, input: CostVersionInput, actor: string): Promise<CostVersion> {
      checkActor(actor);
      return withTenantDb(async (client) => {
        const db = drizzle(client); await lockedProducts(db, [productId]);
        const [cost] = await db.insert(productCosts).values({ ...input, note: input.note ?? '', productId, actor, effectiveAt: new Date(input.effectiveAt) }).returning();
        return mapCost(cost);
      });
    },
    async performance(query: SaleQuery): Promise<SalesPerformance> {
      const { from, to } = range(query);
      if (query.type && !['endproduct', 'service', 'consumable'].includes(query.type)) throw new SalesError('INVALID_SALES_INPUT', 400);
      return withTenantDb(async (client) => performanceInTransaction(drizzle(client), query, from, to));
    },
  };
}

async function performanceInTransaction(db: Db, query: SaleQuery, from?: string, to?: string): Promise<SalesPerformance> {
  // Returns use event dates, so original sales outside the range must still be
  // available for original price/cost attribution. No live catalog values enter.
  const rows = await db.select().from(sales).where(sql`${sales.completedAt} is not null`).orderBy(asc(sales.completedAt), asc(sales.id));
  const returns = await db.select().from(saleReturns).orderBy(asc(saleReturns.createdAt), asc(saleReturns.id));
  const term = query.q?.trim().toLocaleLowerCase('ro');
  const byProduct = new Map<string, ProductPerformance>(); const trends = new Map<string, SalesPerformance['trend'][number]>();
  let coveredActivity = 0; let totalActivity = 0; let costActivity = 0; let anyCost = false;
  const day = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
  const included = (date: string) => (!from || date >= from) && (!to || date <= to);
  const add = (row: SaleRow, line: SaleLine, date: string, amount: number, quantity: number, returned: boolean, restock: boolean, returnedCost = 0) => {
    if (!included(date) || (query.type && line.productType !== query.type)
      || (term && !`${line.name} ${line.sku}`.toLocaleLowerCase('ro').includes(term))) return;
    const key = `${line.productId}:${line.unitType}`;
    let p = byProduct.get(key);
    if (!p) { p = { productId: line.productId, name: line.name, sku: line.sku, unitType: line.unitType, productType: line.productType,
      quantitySold: 0, quantityReturned: 0, grossSalesCents: 0, returnedCents: 0, netSalesCents: 0,
      coveredSalesCents: 0, estimatedCostCents: null, estimatedProfitCents: null, marginPercent: null }; byProduct.set(key, p); }
    let trend = trends.get(date); if (!trend) { trend = { date, grossSalesCents: 0, returnedCents: 0, netSalesCents: 0 }; trends.set(date, trend); }
    const sign = returned ? -1 : 1;
    if (returned) { p.returnedCents += amount; p.quantityReturned = (millis(p.quantityReturned) + millis(quantity)) / 1000; trend.returnedCents += amount; }
    else { p.grossSalesCents += amount; p.quantitySold = (millis(p.quantitySold) + millis(quantity)) / 1000; trend.grossSalesCents += amount; }
    p.netSalesCents += sign * amount; trend.netSalesCents += sign * amount;
    totalActivity += amount;
    const covered = row.priceBasis === 'tax_exclusive' && line.costBasis === 'tax_exclusive' && line.unitCostCents !== null;
    if (covered) {
      coveredActivity += amount; anyCost = true; p.coveredSalesCents += sign * amount;
      const cost = returned ? (restock ? returnedCost : 0) : saleLineGrossCents(quantity, line.unitCostCents!);
      costActivity += cost;
      p.estimatedCostCents = (p.estimatedCostCents ?? 0) + sign * cost;
      p.estimatedProfitCents = p.coveredSalesCents - p.estimatedCostCents;
    }
  };
  for (const row of rows) {
    const restocked = new Map<string, number>();
    for (const line of row.lines) add(row, line, day(row.completedAt!), line.totalCents, line.quantity, false, false);
    for (const returned of returns.filter((r) => r.saleId === row.id)) {
      for (const request of returned.lines) {
        const line = row.lines.find((l) => l.id === request.saleLineId);
        if (line) {
          const previous = restocked.get(line.id) ?? 0;
          const cost = request.restock && line.unitCostCents !== null
            ? saleReturnAllocationCents(saleLineGrossCents(line.quantity, line.unitCostCents), line.quantity, previous, request.quantity) : 0;
          if (request.restock) restocked.set(line.id, (millis(previous) + millis(request.quantity)) / 1000);
          add(row, line, day(returned.createdAt), request.amountCents, request.quantity, true, request.restock, cost);
        }
      }
    }
  }
  const result = [...byProduct.values()].map((p) => ({ ...p,
    marginPercent: p.estimatedProfitCents !== null && p.coveredSalesCents === p.netSalesCents && p.netSalesCents > 0
      ? p.estimatedProfitCents / p.netSalesCents * 100 : null }));
  const assertExact = (value: number | null) => {
    if (value !== null && !Number.isSafeInteger(value)) throw new SalesError('REPORT_TOTAL_LIMIT', 400);
  };
  for (const p of result) {
    for (const value of [p.grossSalesCents, p.returnedCents, p.netSalesCents, p.coveredSalesCents, p.estimatedCostCents, p.estimatedProfitCents]) assertExact(value);
  }
  for (const t of trends.values()) for (const value of [t.grossSalesCents, t.returnedCents, t.netSalesCents]) assertExact(value);
  // Absolute activity also bounds signed additions: checking it before exposing
  // any sum prevents a long history from silently rounding integer bani.
  assertExact(totalActivity); assertExact(coveredActivity); assertExact(costActivity);
  assertExact(totalActivity + costActivity);
  for (const values of [result.map((p) => p.estimatedCostCents ?? 0), result.map((p) => p.estimatedProfitCents ?? 0)]) {
    assertExact(values.reduce((sum, value) => sum + Math.abs(value), 0));
  }
  result.sort((a, b) => b.netSalesCents - a.netSalesCents || a.name.localeCompare(b.name, 'ro'));
  return { products: result, trend: [...trends.values()].sort((a, b) => a.date.localeCompare(b.date)),
    totalSalesCents: result.reduce((n, p) => n + p.grossSalesCents, 0), returnedCents: result.reduce((n, p) => n + p.returnedCents, 0),
    netSalesCents: result.reduce((n, p) => n + p.netSalesCents, 0), coveredSalesCents: result.reduce((n, p) => n + p.coveredSalesCents, 0),
    // Absolute sale/return event amounts provide a defined coverage measure even
    // for return-only/negative periods; financial totals still use signed events.
    costCoveragePercent: totalActivity > 0 ? coveredActivity / totalActivity * 100 : null,
    estimatedProfitCents: anyCost ? result.reduce((n, p) => n + (p.estimatedProfitCents ?? 0), 0) : null,
    from: from ?? null, to: to ?? null };
}

export type SalesRepo = ReturnType<typeof createSalesRepo>;
export type SalesDbClient = DbClient;
