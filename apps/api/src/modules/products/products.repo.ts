import { asc, count, desc, eq, ilike, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { withTenantDb, type DbClient } from "../../db/withDb";
import { quantityToMillis } from '@retail/shared-types';
import type { Product, ProductSortField, ProductType, UnitType, StockMovement, StockMovementInput } from "@retail/shared-types";
import { products, stockMovements } from "./products.schema";
import { productCosts } from '../sales/sales.schema';
import { InventoryError } from './inventory-error';

export interface ProductFilter {
  page: number;
  pageSize: number;
  q?: string;
  sort?: ProductSortField;
  direction?: 'asc' | 'desc';
  includeLatestCost?: boolean;
}

export interface NewProduct {
  name: string;
  sku: string;
  priceCents: number;
  stock: number;
  unitType: UnitType;
  productType: ProductType;
}

export interface ProductsRepo {
  list(filter: ProductFilter): Promise<{ items: Product[]; total: number }>;
  getById(id: string): Promise<Product | null>;
  create(input: NewProduct, actor?: string): Promise<Product>;
  update(id: string, input: NewProduct): Promise<Product | null>;
  remove(id: string): Promise<boolean>;
  movements(id: string, page: number, pageSize: number): Promise<{ movements: StockMovement[]; total: number }>;
  move(id: string, input: StockMovementInput, actor: string): Promise<StockMovement>;
  reverse(id: string, movementId: string, reason: string, key: string, actor: string): Promise<StockMovement>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapRow(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    priceCents: row.priceCents,
    stock: Number(row.stock),
    unitType: row.unitType as UnitType,
    productType: row.productType as ProductType,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapMovement(row: typeof stockMovements.$inferSelect, reversed = false): StockMovement {
  return { id: row.id, productId: row.productId, kind: row.kind as StockMovement['kind'],
    delta: Number(row.delta), before: Number(row.before), after: Number(row.after),
    unitType: row.unitType as UnitType, reason: row.reason, actor: row.actor,
    createdAt: row.createdAt.toISOString(), reversalOf: row.reversalOf, reversed,
    saleId: row.saleId, saleLineId: row.saleLineId, saleReturnId: row.saleReturnId };
}

function storedMillis(value: number): number {
  const result = quantityToMillis(value);
  if (result === undefined) throw new InventoryError('INVALID_INVENTORY_INPUT', 400);
  return result;
}

/** Every mutation locks the same product row; the transaction owns both balance
 * and ledger write. Advisory keys serialize retries even across different products. */
async function recordMovement(id: string, input: StockMovementInput | { reversalId: string; reason: string; idempotencyKey: string }, actor: string): Promise<StockMovement> {
  if (!actor?.trim()) throw new InventoryError('MISSING_USER_SUBJECT', 401);
  return withTenantDb(async (client) => {
    const db = drizzle(client);
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(current_schema() || ':' || ${input.idempotencyKey}, 0))`);
    const fingerprint = JSON.stringify({ product: id, ...input });
    const [previous] = await db.select().from(stockMovements).where(eq(stockMovements.idempotencyKey, input.idempotencyKey));
    if (previous) {
      if (previous.requestFingerprint !== fingerprint) throw new InventoryError('IDEMPOTENCY_CONFLICT');
      return mapMovement(previous);
    }
    const [product] = await db.select().from(products).where(eq(products.id, id)).for('update');
    if (!product) throw new InventoryError('PRODUCT_NOT_FOUND', 404);
    if (product.productType === 'service') throw new InventoryError('SERVICE_NOT_TRACKED');
    let deltaMillis: number;
    let reversalOf: string | null = null;
    let kind: StockMovement['kind'];
    if ('reversalId' in input) {
      const [original] = await db.select().from(stockMovements).where(eq(stockMovements.id, input.reversalId));
      if (!original || original.productId !== id) throw new InventoryError('MOVEMENT_NOT_FOUND', 404);
      if (original.saleId) throw new InventoryError('SALE_MOVEMENT_PROTECTED');
      if (original.kind === 'opening' || original.kind === 'reversal' || original.actor.startsWith('system:')) throw new InventoryError('MOVEMENT_NOT_REVERSIBLE');
      const [reversed] = await db.select({ id: stockMovements.id }).from(stockMovements).where(eq(stockMovements.reversalOf, original.id));
      if (reversed) throw new InventoryError('MOVEMENT_ALREADY_REVERSED');
      deltaMillis = -storedMillis(Number(original.delta));
      reversalOf = original.id;
      kind = 'reversal';
    } else {
      deltaMillis = storedMillis(input.quantity);
      if (product.unitType === 'unit' && deltaMillis % 1000 !== 0) throw new InventoryError('WHOLE_UNITS_REQUIRED', 400);
      if (input.kind === 'consume' || input.kind === 'waste') deltaMillis = -deltaMillis;
      kind = input.kind;
    }
    const beforeMillis = storedMillis(Number(product.stock));
    const afterMillis = beforeMillis + deltaMillis;
    if (afterMillis < 0) throw new InventoryError('INSUFFICIENT_STOCK');
    if (afterMillis > 1_000_000_000) throw new InventoryError('STOCK_LIMIT');
    const [movement] = await db.insert(stockMovements).values({
      productId: id, kind, delta: String(deltaMillis / 1000), before: String(beforeMillis / 1000),
      after: String(afterMillis / 1000), unitType: product.unitType, reason: input.reason,
      actor, reversalOf, idempotencyKey: input.idempotencyKey, requestFingerprint: fingerprint
    }).returning();
    await db.update(products).set({ stock: String(afterMillis / 1000), updatedAt: new Date() }).where(eq(products.id, id));
    return mapMovement(movement);
  });
}

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
function likePattern(q: string): string {
  return `%${q.replace(/([\\%_])/g, "\\$1")}%`;
}

/**
 * Tenant-scoped product storage (TICKET-101), on the Drizzle query builder.
 * The security architecture is unchanged: every query still runs through
 * withTenantDb (BEGIN; SET LOCAL search_path; SET LOCAL ROLE), where Drizzle
 * is bound to that transaction's client - type-checked columns,
 * parameterized SQL, no hand-written strings.
 */
export function createProductsRepo(): ProductsRepo {
  return {
    async list(filter) {
      return withTenantDb(async (client: DbClient) => {
        const db = drizzle(client);
        const where = filter.q ? ilike(products.name, likePattern(filter.q)) : undefined;
        const latestCost = sql<number | null>`(select ${productCosts.unitCostCents} from ${productCosts}
          where ${productCosts.productId} = ${products.id} and ${productCosts.effectiveAt} <= now()
          order by ${productCosts.effectiveAt} desc, ${productCosts.createdAt} desc, ${productCosts.id} desc limit 1)`;
        const sortable = {
          name: products.name, type: products.productType, sku: products.sku,
          price: products.priceCents,
          cost: latestCost,
          // Services have no operational stock and sort after tracked items.
          stock: sql`case when ${products.productType} = 'service' then null else ${products.stock} end`,
          updated: products.updatedAt
        };
        const column = filter.sort ? sortable[filter.sort] : products.createdAt;
        const order = filter.sort && filter.direction !== 'desc' ? asc(column) : desc(column);
        let items: Product[];
        if (filter.includeLatestCost) {
          const rows = await db.select({ product: products, latestCostCents: latestCost }).from(products)
            .where(where).orderBy(sql`${order} nulls last`, asc(products.id))
            .limit(filter.pageSize).offset((filter.page - 1) * filter.pageSize);
          items = rows.map((row) => ({ ...mapRow(row.product), latestCostCents: row.latestCostCents }));
        } else {
          const rows = await db.select({ product: products }).from(products)
            .where(where).orderBy(sql`${order} nulls last`, asc(products.id))
            .limit(filter.pageSize).offset((filter.page - 1) * filter.pageSize);
          items = rows.map((row) => mapRow(row.product));
        }
        const [{ value: total }] = await db.select({ value: count() }).from(products).where(where);
        return { items, total };
      });
    },

    async getById(id) {
      if (!UUID_RE.test(id)) {
        return null;
      }
      return withTenantDb(async (client: DbClient) => {
        const [row] = await drizzle(client).select().from(products).where(eq(products.id, id));
        return row ? mapRow(row) : null;
      });
    },

    async create(input, actor) {
      if (!actor?.trim()) throw new InventoryError('MISSING_USER_SUBJECT', 401);
      return withTenantDb(async (client: DbClient) => {
        const [row] = await drizzle(client)
          .insert(products)
          .values({
            name: input.name,
            sku: input.sku,
            priceCents: input.priceCents,
            stock: String(input.stock),
            unitType: input.unitType,
            productType: input.productType
          })
          .returning();
        if (input.productType !== 'service') {
          await drizzle(client).insert(stockMovements).values({ productId: row.id, kind: 'opening', delta: String(input.stock),
            before: '0', after: String(input.stock), unitType: input.unitType, reason: 'Opening stock', actor });
        }
        return mapRow(row);
      });
    },

    async update(id, input) {
      if (!UUID_RE.test(id)) {
        return null;
      }
      return withTenantDb(async (client: DbClient) => {
        const db = drizzle(client);
        const [existing] = await db.select().from(products).where(eq(products.id, id)).for('update');
        if (!existing) return null;
        if (quantityToMillis(input.stock) !== quantityToMillis(Number(existing.stock))) throw new InventoryError('STOCK_MOVEMENT_REQUIRED');
        const [history] = await db.select({ id: stockMovements.id }).from(stockMovements).where(eq(stockMovements.productId, id)).limit(1);
        if ((history || Number(existing.stock) !== 0) && (existing.unitType !== input.unitType || existing.productType !== input.productType)) throw new InventoryError('PRODUCT_CLASSIFICATION_LOCKED');
        if (existing.unitType !== input.unitType || existing.productType !== input.productType) {
          const financialHistory = await db.execute(sql`select 1 from product_cost_versions where product_id = ${id}
            union all select 1 from sale_product_links where product_id = ${id} limit 1`);
          if (financialHistory.rows.length) throw new InventoryError('PRODUCT_CLASSIFICATION_LOCKED');
        }
        const [row] = await db
          .update(products)
          .set({
            name: input.name,
            sku: input.sku,
            priceCents: input.priceCents,
            unitType: input.unitType,
            productType: input.productType,
            updatedAt: new Date()
          })
          .where(eq(products.id, id))
          .returning();
        return row ? mapRow(row) : null;
      });
    },

    async remove(id) {
      if (!UUID_RE.test(id)) {
        return false;
      }
      return withTenantDb(async (client: DbClient) => {
        const db = drizzle(client);
        const [existing] = await db.select().from(products).where(eq(products.id, id)).for('update');
        if (!existing) return false;
        const [history] = await db.select({ id: stockMovements.id }).from(stockMovements).where(eq(stockMovements.productId, id)).limit(1);
        if (history) throw new InventoryError('PRODUCT_HAS_HISTORY');
        const linked = await db.execute(sql`select 1 from sale_product_links where product_id = ${id} limit 1`);
        if (linked.rows.length) throw new InventoryError('PRODUCT_HAS_SALES');
        const costHistory = await db.execute(sql`select 1 from product_cost_versions where product_id = ${id} limit 1`);
        if (costHistory.rows.length) throw new InventoryError('PRODUCT_HAS_HISTORY');
        const deleted = await db
          .delete(products)
          .where(eq(products.id, id))
          .returning({ id: products.id });
        return deleted.length > 0;
      });
    },

    async movements(id, page, pageSize) {
      return withTenantDb(async (client) => {
        const db = drizzle(client);
        const rows = await db.select({ movement: stockMovements,
          // Keep the outer qualifier explicit: Drizzle can dequalify a column
          // interpolation in a single-table select, binding it to the inner row.
          reversed: sql<boolean>`exists(select 1 from stock_movements r where r.reversal_of = stock_movements.id)`
        }).from(stockMovements).where(eq(stockMovements.productId, id))
          .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id)).limit(pageSize).offset((page - 1) * pageSize);
        const [{ value: total }] = await db.select({ value: count() }).from(stockMovements).where(eq(stockMovements.productId, id));
        return { movements: rows.map((r) => mapMovement(r.movement, r.reversed)), total };
      });
    },
    move: recordMovement,
    reverse: (id, movementId, reason, key, actor) => recordMovement(id, { reversalId: movementId, reason, idempotencyKey: key }, actor)
  };
}
