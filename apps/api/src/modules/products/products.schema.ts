import { integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Tenant-scoped products table (TICKET-101). Defined once here; Drizzle maps
 * the camelCase TS fields to the snake_case columns created by the
 * `0002_products` tenant migration.
 */
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  priceCents: integer("price_cents").notNull(),
  stock: numeric("stock", { precision: 15, scale: 3 }).notNull().default('0'),
  unitType: text("unit_type").notNull().default("unit"),
  productType: text("product_type").notNull().default("endproduct"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull(),
  kind: text('kind').notNull(),
  delta: numeric('delta', { precision: 15, scale: 3 }).notNull(),
  before: numeric('before_quantity', { precision: 15, scale: 3 }).notNull(),
  after: numeric('after_quantity', { precision: 15, scale: 3 }).notNull(),
  unitType: text('unit_type').notNull(),
  reason: text('reason').notNull(),
  actor: text('actor').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  reversalOf: uuid('reversal_of'),
  idempotencyKey: uuid('idempotency_key'),
  requestFingerprint: text('request_fingerprint'),
  saleId: uuid('sale_id'),
  saleLineId: uuid('sale_line_id'),
  saleReturnId: uuid('sale_return_id')
});
