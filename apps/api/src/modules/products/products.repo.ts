import { count, desc, eq, ilike } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { withTenantDb, type DbClient } from "../../db/withDb";
import type { Product } from "@retail/shared-types";
import { products } from "./products.schema";

export interface ProductFilter {
  page: number;
  pageSize: number;
  q?: string;
}

export interface NewProduct {
  name: string;
  sku: string;
  priceCents: number;
  stock: number;
}

export interface ProductsRepo {
  list(filter: ProductFilter): Promise<{ items: Product[]; total: number }>;
  getById(id: string): Promise<Product | null>;
  create(input: NewProduct): Promise<Product>;
  update(id: string, input: NewProduct): Promise<Product | null>;
  remove(id: string): Promise<boolean>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapRow(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    priceCents: row.priceCents,
    stock: row.stock,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
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
        const rows = await db
          .select()
          .from(products)
          .where(where)
          .orderBy(desc(products.createdAt))
          .limit(filter.pageSize)
          .offset((filter.page - 1) * filter.pageSize);
        const [{ value: total }] = await db.select({ value: count() }).from(products).where(where);
        return { items: rows.map(mapRow), total };
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

    async create(input) {
      return withTenantDb(async (client: DbClient) => {
        const [row] = await drizzle(client)
          .insert(products)
          .values({ name: input.name, sku: input.sku, priceCents: input.priceCents, stock: input.stock })
          .returning();
        return mapRow(row);
      });
    },

    async update(id, input) {
      if (!UUID_RE.test(id)) {
        return null;
      }
      return withTenantDb(async (client: DbClient) => {
        const [row] = await drizzle(client)
          .update(products)
          .set({
            name: input.name,
            sku: input.sku,
            priceCents: input.priceCents,
            stock: input.stock,
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
        const deleted = await drizzle(client)
          .delete(products)
          .where(eq(products.id, id))
          .returning({ id: products.id });
        return deleted.length > 0;
      });
    }
  };
}
