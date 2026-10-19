import { z } from "zod";
import type { Product } from "@retail/shared-types";
import type { NewProduct, ProductsRepo } from "./products.repo";

/** Field-level validation failures (HTTP 400). */
export class ValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string[]>) {
    super("Invalid product data");
  }
}

/** The requested product does not exist (HTTP 404). */
export class ProductNotFoundError extends Error {
  constructor() {
    super("Product not found");
  }
}

/** The SKU already exists in this tenant's catalog (HTTP 409). */
export class SkuConflictError extends Error {
  constructor() {
    super("A product with this SKU already exists");
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const productInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  sku: z
    .string()
    .trim()
    .min(2, "SKU must be at least 2 characters")
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "SKU may only contain letters, numbers and hyphens"),
  priceCents: z
    .number()
    .int("Price must be a whole number of cents")
    .min(0, "Price cannot be negative")
    .max(99_999_999, "Price is too large"),
  stock: z
    .number()
    .int("Stock must be a whole number")
    .min(0, "Stock cannot be negative")
    .max(1_000_000, "Stock is too large")
});

export interface ProductListQuery {
  page?: string;
  pageSize?: string;
  q?: string;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Extracts the PG error code from possibly-wrapped errors: Drizzle wraps the
 * original pg error in a `DrizzleQueryError` whose `cause` carries `code`.
 */
function pgErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const code = (current as { code?: string }).code;
    if (typeof code === "string") {
      return code;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Wraps a low-level PG error as a domain conflict when the SKU unique index fires. */
function mapRepoError(err: unknown): unknown {
  if (pgErrorCode(err) === "23505") {
    return new SkuConflictError();
  }
  return err;
}

/**
 * Tenant-scoped product business logic (TICKET-101). Validates and clamps
 * input, maps storage errors to domain errors, and delegates storage to the
 * repository. Created as a factory so unit tests can substitute the repo.
 */
export function createProductsService(repo: ProductsRepo) {
  function parseInput(body: unknown): NewProduct {
    const parsed = productInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }
    return parsed.data;
  }

  function parseId(id: string): string {
    if (!UUID_RE.test(id)) {
      // Malformed ids cannot name a product — same response as a miss.
      throw new ProductNotFoundError();
    }
    return id;
  }

  return {
    /** List with pagination + name search. Query values arrive as strings. */
    async list(query: ProductListQuery): Promise<{ products: Product[]; total: number; page: number; pageSize: number }> {
      const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
      const requestedPageSize = Number.parseInt(query.pageSize ?? String(DEFAULT_PAGE_SIZE), 10);
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedPageSize || DEFAULT_PAGE_SIZE));
      const { items, total } = await repo.list({ page, pageSize, q: query.q?.trim() || undefined });
      return { products: items, total, page, pageSize };
    },

    async get(id: string): Promise<Product> {
      const product = await repo.getById(parseId(id));
      if (!product) {
        throw new ProductNotFoundError();
      }
      return product;
    },

    async create(body: unknown): Promise<Product> {
      const input = parseInput(body);
      try {
        return await repo.create(input);
      } catch (err) {
        throw mapRepoError(err);
      }
    },

    async update(id: string, body: unknown): Promise<Product> {
      const input = parseInput(body);
      try {
        const product = await repo.update(parseId(id), input);
        if (!product) {
          throw new ProductNotFoundError();
        }
        return product;
      } catch (err) {
        throw mapRepoError(err);
      }
    },

    async remove(id: string): Promise<void> {
      const removed = await repo.remove(parseId(id));
      if (!removed) {
        throw new ProductNotFoundError();
      }
    }
  };
}
