import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Platform-level module grants for each workspace (`public.tenant_module_entitlements`). */
export const tenantModuleEntitlements = pgTable("tenant_module_entitlements", {
  tenantId: uuid("tenant_id").notNull(),
  moduleKey: text("module_key").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
