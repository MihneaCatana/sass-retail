import { Router, type Response } from "express";
import { requireRole } from "../../middleware/requireRole";
import { createProductsRepo } from "./products.repo";
import { InventoryError } from './inventory-error';
import { getTenantContext } from '../../db/context';
import { getEnabledModules } from '../tenants/moduleEntitlements';
import {
  createProductsService,
  ProductNotFoundError,
  SkuConflictError,
  ValidationError
} from "./products.service";

export const productsRouter = Router();

const products = createProductsService(createProductsRepo());

/** Maps domain errors to their HTTP responses; returns false for unknown errors. */
function respondError(res: Response, err: unknown): boolean {
  if (err instanceof InventoryError) {
    res.status(err.status).json({ error: err.code, code: err.code });
    return true;
  }
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message, code: 'INVALID_INVENTORY_INPUT', details: err.fieldErrors });
    return true;
  }
  if (err instanceof ProductNotFoundError) {
    res.status(404).json({ error: err.message });
    return true;
  }
  if (err instanceof SkuConflictError) {
    res.status(409).json({ error: err.message });
    return true;
  }
  return false;
}

function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

productsRouter.get("/", async (req, res, next) => {
  try {
    const modules = await getEnabledModules(getTenantContext().tenantId);
    const includeLatestCost = (req.auth?.roles.includes('tenant-admin') ?? false)
      && modules.includes('sales-insights');
    res.json(
      await products.list({
        page: queryString(req.query.page),
        pageSize: queryString(req.query.pageSize),
        q: queryString(req.query.q),
        sort: queryString(req.query.sort),
        direction: queryString(req.query.direction)
      }, includeLatestCost)
    );
  } catch (err) {
    if (respondError(res, err)) return;
    next(err);
  }
});

productsRouter.get("/:id", async (req, res, next) => {
  try {
    res.json(await products.get(String(req.params.id)));
  } catch (err) {
    if (respondError(res, err)) return;
    next(err);
  }
});

productsRouter.post("/", requireRole("tenant-admin"), async (req, res, next) => {
  try {
    if (!req.auth?.sub) throw new InventoryError('MISSING_USER_SUBJECT', 401);
    res.status(201).json(await products.create(req.body, req.auth.sub));
  } catch (err) {
    if (respondError(res, err)) return;
    next(err);
  }
});

productsRouter.put("/:id", requireRole("tenant-admin"), async (req, res, next) => {
  try {
    res.json(await products.update(String(req.params.id), req.body));
  } catch (err) {
    if (respondError(res, err)) return;
    next(err);
  }
});

productsRouter.delete("/:id", requireRole("tenant-admin"), async (req, res, next) => {
  try {
    await products.remove(String(req.params.id));
    res.status(204).end();
  } catch (err) {
    if (respondError(res, err)) return;
    next(err);
  }
});

productsRouter.get('/:id/movements', async (req, res, next) => {
  try {
    res.json(await products.movements(String(req.params.id), { page: queryString(req.query.page), pageSize: queryString(req.query.pageSize) }));
  } catch (err) { if (!respondError(res, err)) next(err); }
});

productsRouter.post('/:id/movements', requireRole('tenant-admin'), async (req, res, next) => {
  try {
    if (!req.auth?.sub) throw new InventoryError('MISSING_USER_SUBJECT', 401);
    res.status(201).json(await products.move(String(req.params.id), req.body, req.auth.sub));
  } catch (err) { if (!respondError(res, err)) next(err); }
});

productsRouter.post('/:id/movements/:movementId/reverse', requireRole('tenant-admin'), async (req, res, next) => {
  try {
    if (!req.auth?.sub) throw new InventoryError('MISSING_USER_SUBJECT', 401);
    res.status(201).json(await products.reverse(String(req.params.id), String(req.params.movementId), req.body, req.auth.sub));
  } catch (err) { if (!respondError(res, err)) next(err); }
});
