import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
  stock: integer("stock").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
