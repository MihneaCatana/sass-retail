import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Platform audit trail (`public.audit_log`) - append-only from the API. */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  details: jsonb("details").notNull()
});
