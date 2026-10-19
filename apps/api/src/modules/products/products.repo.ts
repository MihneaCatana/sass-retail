import { withTenantDb, type DbClient } from "../../db/withDb";
import type { Product } from "@retail/shared-types";

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  price_cents: number;
  stock: number;
  created_at: Date;
  updated_at: Date;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    priceCents: row.price_cents,
    stock: row.stock,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
function likePattern(q: string): string {
  return `%${q.replace(/([\\%_])/g, "\\$1")}%`;
}

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

/**
 * Tenant-scoped product storage (TICKET-101). Every query runs through
 * withTenantDb — schema AND role come from the tenant context, and every
 * statement is parameterized.
 */
export function createProductsRepo(): ProductsRepo {
  function listPage(client: DbClient, pattern: string | null, pageSize: number, offset: number) {
    return client.query<ProductRow>(
      `SELECT id, name, sku, price_cents, stock, created_at, updated_at
         FROM products
        WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [pattern, pageSize, offset]
    );
  }

  return {
    async list(filter) {
      return withTenantDb(async (client) => {
        const pattern = filter.q ? likePattern(filter.q) : null;
        const offset = (filter.page - 1) * filter.pageSize;
        const count = await client.query<{ total: number }>(
          `SELECT count(*)::int AS total
             FROM products
            WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%')`,
          [pattern]
        );
        const rows = await listPage(client, pattern, filter.pageSize, offset);
        return { items: rows.rows.map(mapRow), total: count.rows[0].total };
      });
    },

    async getById(id) {
      if (!UUID_RE.test(id)) {
        return null;
      }
      return withTenantDb(async (client) => {
        const result = await client.query<ProductRow>(
          `SELECT id, name, sku, price_cents, stock, created_at, updated_at
             FROM products
            WHERE id = $1`,
          [id]
        );
        return result.rows[0] ? mapRow(result.rows[0]) : null;
      });
    },

    async create(input) {
      return withTenantDb(async (client) => {
        const result = await client.query<ProductRow>(
          `INSERT INTO products (name, sku, price_cents, stock)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name, sku, price_cents, stock, created_at, updated_at`,
          [input.name, input.sku, input.priceCents, input.stock]
        );
        return mapRow(result.rows[0]);
      });
    },

    async update(id, input) {
      if (!UUID_RE.test(id)) {
        return null;
      }
      return withTenantDb(async (client) => {
        const result = await client.query<ProductRow>(
          `UPDATE products
              SET name = $1, sku = $2, price_cents = $3, stock = $4, updated_at = now()
            WHERE id = $5
            RETURNING id, name, sku, price_cents, stock, created_at, updated_at`,
          [input.name, input.sku, input.priceCents, input.stock, id]
        );
        return result.rows[0] ? mapRow(result.rows[0]) : null;
      });
    },

    async remove(id) {
      if (!UUID_RE.test(id)) {
        return false;
      }
      return withTenantDb(async (client) => {
        const result = await client.query("DELETE FROM products WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
      });
    }
  };
}
