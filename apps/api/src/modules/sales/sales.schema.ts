import { bigint, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { SaleLine, SaleReturnLineInput } from '@retail/shared-types';

export const sales = pgTable('sales', {
  id: uuid('id').primaryKey().defaultRandom(), reference: text('reference').notNull(),
  status: text('status').notNull(), revision: integer('revision').notNull().default(1),
  priceBasis: text('price_basis').notNull(), note: text('note').notNull().default(''), actor: text('actor').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  totalCents: bigint('total_cents', { mode: 'number' }).notNull(),
  returnedCents: bigint('returned_cents', { mode: 'number' }).notNull().default(0),
  lines: jsonb('lines').$type<SaleLine[]>().notNull()
});
export const saleReturns = pgTable('sale_returns', {
  id: uuid('id').primaryKey().defaultRandom(), saleId: uuid('sale_id').notNull(),
  kind: text('kind').notNull(), reason: text('reason').notNull(), actor: text('actor').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  totalCents: bigint('total_cents', { mode: 'number' }).notNull(),
  lines: jsonb('lines').$type<Array<SaleReturnLineInput & { amountCents: number }>>().notNull()
});
export const saleOperations = pgTable('sale_operations', {
  idempotencyKey: uuid('idempotency_key').primaryKey(), saleId: uuid('sale_id').notNull(),
  fingerprint: text('fingerprint').notNull()
});
export const saleProductLinks = pgTable('sale_product_links', {
  saleId: uuid('sale_id').notNull(), productId: uuid('product_id').notNull()
});
export const productCosts = pgTable('product_cost_versions', {
  id: uuid('id').primaryKey().defaultRandom(), productId: uuid('product_id').notNull(),
  unitCostCents: integer('unit_cost_cents').notNull(), priceBasis: text('price_basis').notNull(),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(), source: text('source').notNull(),
  note: text('note').notNull().default(''), actor: text('actor').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
