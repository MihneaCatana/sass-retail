import { describe, expect, it, vi } from "vitest";
import { parseQuantityText, quantityToMillis, type Product } from "@retail/shared-types";
import {
  createProductsService,
  ProductNotFoundError,
  SkuConflictError,
  ValidationError
} from "./products.service";
import type { ProductsRepo } from "./products.repo";

const product: Product = {
  id: "3f6a5d0e-1c2b-4a3d-8e5f-000000000001",
  name: "Espresso beans 1kg",
  sku: "ESP-1KG",
  priceCents: 1899,
  stock: 25,
  unitType: "kg",
  productType: "endproduct",
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z"
};

function makeRepo(overrides: Partial<ProductsRepo> = {}) {
  return {
    list: vi.fn().mockResolvedValue({ items: [product], total: 1 }),
    getById: vi.fn().mockResolvedValue(product),
    create: vi.fn().mockResolvedValue(product),
    update: vi.fn().mockResolvedValue(product),
    remove: vi.fn().mockResolvedValue(true),
    movements: vi.fn().mockResolvedValue({ movements: [], total: 0 }),
    move: vi.fn(),
    reverse: vi.fn(),
    ...overrides
  };
}

describe("createProductsService", () => {
  it('validates sorting and passes it to the paginated repository query', async () => {
    const repo = makeRepo();
    const service = createProductsService(repo);
    await service.list({ page: '2', pageSize: '10', q: 'Tea', sort: 'price', direction: 'desc' });
    expect(repo.list).toHaveBeenCalledWith({ page: 2, pageSize: 10, q: 'Tea', sort: 'price', direction: 'desc' });
    await expect(service.list({ sort: 'name;drop table products' })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.list({ sort: 'price', direction: 'sideways' })).rejects.toBeInstanceOf(ValidationError);
  });
  it('accepts exact measured quantities and rejects silent rounding or service balances', async () => {
    const repo = makeRepo();
    const service = createProductsService(repo);
    await service.create({ name: 'Flour', sku: 'FL-1', priceCents: 100, stock: 1.5, unitType: 'kg' });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ stock: 1.5 }));
    for (const input of [
      { stock: 0.0001, unitType: 'kg' }, { stock: 1.5, unitType: 'unit' },
      { stock: 1, productType: 'service' }, { stock: Number.NaN }, { stock: Infinity }
    ]) {
      await expect(service.create(Object.assign({ name: 'A', sku: 'AA', priceCents: 100, stock: 0 }, input))).rejects.toBeInstanceOf(ValidationError);
    }
  });

  it('parses Romanian decimal entry and converts decimal digits exactly', () => {
    expect(parseQuantityText('1,250')).toBe(1.25);
    expect(quantityToMillis(1.001)).toBe(1001);
    expect(quantityToMillis(0.009)).toBe(9);
    expect(quantityToMillis(0.0001)).toBeUndefined();
    expect(parseQuantityText('1.234,50')).toBeUndefined();
    expect(parseQuantityText('1e3')).toBeUndefined();
  });

  it('validates movements and forwards only verified actor and normalized fields', async () => {
    const repo = makeRepo();
    const service = createProductsService(repo);
    const body = { kind: 'consume', quantity: 0.25, reason: '  Used in service  ', idempotencyKey: product.id, actor: 'forged' };
    await service.move(product.id, body, 'verified-subject');
    expect(repo.move).toHaveBeenCalledWith(product.id, { kind: 'consume', quantity: 0.25, reason: 'Used in service', idempotencyKey: product.id }, 'verified-subject');
    for (const invalid of [{ quantity: 0 }, { quantity: -1 }, { quantity: 0.0001 }, { reason: ' ' }, { idempotencyKey: 'bad' }]) {
      await expect(service.move(product.id, { ...body, ...invalid }, 'verified')).rejects.toBeInstanceOf(ValidationError);
    }
  });
  describe("create", () => {
    it("trims and forwards valid input to the repository", async () => {
      const repo = makeRepo();
      const service = createProductsService(repo);

      await service.create({ name: "  Espresso beans 1kg ", sku: " esp-1kg ", priceCents: 1899, stock: 25 });

      expect(repo.create).toHaveBeenCalledWith({
        name: "Espresso beans 1kg",
        sku: "esp-1kg",
        priceCents: 1899,
        stock: 25,
        unitType: "unit",
        productType: "endproduct"
      });
    });

    it("rejects invalid payloads with field-level errors", async () => {
      const repo = makeRepo();
      const service = createProductsService(repo);

      const error = await service
        .create({ name: "", sku: "x", priceCents: -5, stock: 1.5 })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      const fieldErrors = (error as ValidationError).fieldErrors;
      expect(fieldErrors.name).toBeDefined();
      expect(fieldErrors.sku).toBeDefined();
      expect(fieldErrors.priceCents).toBeDefined();
      expect(fieldErrors.stock).toBeDefined();
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("maps the SKU unique violation to a conflict error", async () => {
      const repo = makeRepo({ create: vi.fn().mockRejectedValue({ code: "23505" }) });
      const service = createProductsService(repo);

      await expect(
        service.create({ name: "Another", sku: "ESP-1KG", priceCents: 100, stock: 1 })
      ).rejects.toBeInstanceOf(SkuConflictError);
    });

    it("rethrows storage errors it does not own", async () => {
      const boom = new Error("connection refused");
      const repo = makeRepo({ create: vi.fn().mockRejectedValue(boom) });
      const service = createProductsService(repo);

      await expect(service.create({ name: "A", sku: "A-1", priceCents: 1, stock: 1 })).rejects.toBe(boom);
    });
  });

  describe("list", () => {
    it("defaults and clamps pagination", async () => {
      const repo = makeRepo();
      const service = createProductsService(repo);

      await service.list({});
      expect(repo.list).toHaveBeenCalledWith({ page: 1, pageSize: 20, q: undefined });

      await service.list({ page: "0", pageSize: "500" });
      expect(repo.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 100, q: undefined });
    });

    it("trims the search term and drops empty ones", async () => {
      const repo = makeRepo();
      const service = createProductsService(repo);

      await service.list({ q: "  beans  " });
      expect(repo.list).toHaveBeenCalledWith({ page: 1, pageSize: 20, q: "beans" });

      await service.list({ q: "   " });
      expect(repo.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, q: undefined });
    });
  });

  describe("get / update / remove", () => {
    it("treats malformed ids as not-found without touching storage", async () => {
      const repo = makeRepo();
      const service = createProductsService(repo);

      await expect(service.get("not-a-uuid")).rejects.toBeInstanceOf(ProductNotFoundError);
      await expect(service.update("not-a-uuid", { name: "A", sku: "A-1", priceCents: 1, stock: 1 })).rejects.toBeInstanceOf(
        ProductNotFoundError
      );
      await expect(service.remove("not-a-uuid")).rejects.toBeInstanceOf(ProductNotFoundError);
      expect(repo.getById).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it("maps repository misses to not-found", async () => {
      const repo = makeRepo({
        getById: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(null),
        remove: vi.fn().mockResolvedValue(false)
      });
      const service = createProductsService(repo);

      await expect(service.get(product.id)).rejects.toBeInstanceOf(ProductNotFoundError);
      await expect(service.update(product.id, { name: "A", sku: "A-1", priceCents: 1, stock: 1 })).rejects.toBeInstanceOf(
        ProductNotFoundError
      );
      await expect(service.remove(product.id)).rejects.toBeInstanceOf(ProductNotFoundError);
    });

    it("maps update SKU conflicts to a conflict error", async () => {
      const repo = makeRepo({ update: vi.fn().mockRejectedValue({ code: "23505" }) });
      const service = createProductsService(repo);

      await expect(
        service.update(product.id, { name: "A", sku: "DUP", priceCents: 1, stock: 1 })
      ).rejects.toBeInstanceOf(SkuConflictError);
    });
  });
});
