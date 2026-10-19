import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Platform-level tenant registry (`public.tenants`). */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  schemaName: text("schema_name").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  plan: text("plan").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
