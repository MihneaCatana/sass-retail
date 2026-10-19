import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "./pool";

/**
 * Pool-level Drizzle instance for platform (public-schema) reads and writes:
 * the tenant registry, the audit log. The connect role holds direct SELECT
 * grants on those tables (no role switching needed).
 *
 * Tenant-scoped queries must NOT use this - they go through `withTenantDb`,
 * where Drizzle is bound to the transaction client instead
 * (BEGIN; SET LOCAL search_path; SET LOCAL ROLE).
 */
export const db = drizzle(pool);
