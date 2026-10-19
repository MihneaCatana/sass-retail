import { Router, type Response } from "express";
import { requireRole } from "../../middleware/requireRole";
import { createProductsRepo } from "./products.repo";
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
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message, details: err.fieldErrors });
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
    res.json(
      await products.list({
        page: queryString(req.query.page),
        pageSize: queryString(req.query.pageSize),
        q: queryString(req.query.q)
      })
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
    res.status(201).json(await products.create(req.body));
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
