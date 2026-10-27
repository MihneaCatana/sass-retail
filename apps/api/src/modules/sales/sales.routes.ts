import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireRole } from '../../middleware/requireRole';
import { createSalesRepo, type SaleQuery } from './sales.repo';
import { cancelSchema, completeSchema, costSchema, discardSchema, draftSchema, parse, returnSchema, SalesError, validId } from './sales.validation';
import type { Sale } from '@retail/shared-types';
import { requireModule } from '../../middleware/requireModule';

const repo = createSalesRepo();
export const salesRouter = Router();
export const productCostsRouter = Router();
const admin = requireRole('tenant-admin');
function query(req: Request): SaleQuery {
  const result: Record<string, string> = {};
  for (const key of ['q', 'status', 'from', 'to', 'page', 'pageSize', 'type', 'productId']) {
    const value = req.query[key];
    if (value !== undefined && (typeof value !== 'string' || value.length > 200)) throw new SalesError('INVALID_SALES_INPUT', 400);
    if (typeof value === 'string' && value.length) result[key] = value;
  }
  return result;
}
function actor(req: Request) {
  if (!req.auth?.sub) throw new SalesError('MISSING_USER_SUBJECT', 401);
  return req.auth.sub;
}
function visible(sale: Sale, req: Request): Sale {
  if (req.auth?.roles.includes('tenant-admin')) return sale;
  return { ...sale, lines: sale.lines.map((line) => ({ ...line, unitCostCents: null, costVersionId: null, costBasis: null })) };
}
function route(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((error: unknown) => {
      if (error instanceof SalesError) res.status(error.status).json({ error: error.code, code: error.code });
      else next(error);
    });
  };
}
salesRouter.get('/performance', requireModule('sales-insights'), admin, route(async (req, res) => res.json(await repo.performance(query(req)))));
salesRouter.get('/', route(async (req, res) => {
  const page = await repo.list(query(req));
  res.json({ ...page, sales: page.sales.map((sale) => visible(sale, req)) });
}));
salesRouter.post('/', admin, route(async (req, res) => res.status(201).json(await repo.save(parse(draftSchema, req.body), actor(req)))));
salesRouter.get('/:id', route(async (req, res) => res.json(visible(await repo.get(validId(String(req.params.id))), req))));
salesRouter.put('/:id', admin, route(async (req, res) => res.json(await repo.save(parse(draftSchema, req.body), actor(req), validId(String(req.params.id))))));
salesRouter.post('/:id/complete', admin, route(async (req, res) => {
  const input = parse(completeSchema, req.body);
  res.json(await repo.complete(validId(String(req.params.id)), input.revision, input.idempotencyKey, actor(req)));
}));
salesRouter.post('/:id/discard', admin, route(async (req, res) => {
  const input = parse(discardSchema, req.body);
  res.json(await repo.discard(validId(String(req.params.id)), input.revision));
}));
salesRouter.post('/:id/returns', admin, route(async (req, res) => res.json(await repo.returnSale(validId(String(req.params.id)), parse(returnSchema, req.body), actor(req)))));
salesRouter.post('/:id/cancel', admin, route(async (req, res) => res.json(await repo.returnSale(validId(String(req.params.id)), parse(cancelSchema, req.body), actor(req)))));
productCostsRouter.get('/:id/costs', requireModule('sales-insights'), admin, route(async (req, res) => res.json(await repo.costs(validId(String(req.params.id))))));
productCostsRouter.post('/:id/costs', requireModule('sales-insights'), admin, route(async (req, res) => res.status(201).json(await repo.addCost(validId(String(req.params.id)), parse(costSchema, req.body), actor(req)))));
