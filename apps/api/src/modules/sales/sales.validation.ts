import { z } from 'zod';
import { PRICE_BASES, quantityToMillis, saleLineGrossCents } from '@retail/shared-types';

export class SalesError extends Error {
  constructor(readonly code: string, readonly status = 409) { super(code); }
}
const quantity = z.number().finite().positive().max(1_000_000).refine((q) => quantityToMillis(q) !== undefined);
const cents = z.number().int().min(0).max(99_999_999);
export const draftSchema = z.object({
  lines: z.array(z.object({ productId: z.string().uuid(), quantity, unitPriceCents: cents,
    discountCents: cents, priceOverrideReason: z.string().trim().max(500).optional() })).min(1).max(100),
  priceBasis: z.enum(PRICE_BASES), note: z.string().trim().max(1000).optional(),
  revision: z.number().int().min(1).optional()
}).superRefine((value, ctx) => {
  const ids = new Set<string>();
  for (const line of value.lines) {
    if (ids.has(line.productId)) ctx.addIssue({ code: 'custom', message: 'Duplicate product', path: ['lines'] });
    ids.add(line.productId);
    if (line.quantity > 0 && quantityToMillis(line.quantity) !== undefined && Number.isSafeInteger(line.unitPriceCents) && line.unitPriceCents >= 0
      && line.discountCents > saleLineGrossCents(line.quantity, line.unitPriceCents)) {
      ctx.addIssue({ code: 'custom', message: 'Discount exceeds gross amount', path: ['lines'] });
    }
  }
});
export const completeSchema = z.object({ revision: z.number().int().positive(), idempotencyKey: z.string().uuid() });
export const discardSchema = z.object({ revision: z.number().int().positive() });
export const returnSchema = z.object({
  lines: z.array(z.object({ saleLineId: z.string().uuid(), quantity, restock: z.boolean() })).min(1).max(100),
  reason: z.string().trim().min(1).max(500), idempotencyKey: z.string().uuid()
}).refine((v) => new Set(v.lines.map((l) => l.saleLineId)).size === v.lines.length);
export const cancelSchema = z.object({ reason: z.string().trim().min(1).max(500),
  idempotencyKey: z.string().uuid(), restock: z.boolean() });
export const costSchema = z.object({ unitCostCents: cents, priceBasis: z.enum(PRICE_BASES),
  effectiveAt: z.string().datetime({ offset: true }), source: z.enum(['purchase', 'production', 'service', 'estimate']),
  note: z.string().trim().max(1000).optional() });
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new SalesError('INVALID_SALES_INPUT', 400);
  return parsed.data;
}
export function validId(id: string): string {
  if (!z.string().uuid().safeParse(id).success) throw new SalesError('SALE_NOT_FOUND', 404);
  return id;
}
export function validProductFilter(id: string | undefined): string | undefined {
  if (id !== undefined && !z.string().uuid().safeParse(id).success) throw new SalesError('INVALID_SALES_INPUT', 400);
  return id;
}
export function validDay(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString().slice(0, 10) !== value) throw new SalesError('INVALID_SALES_INPUT', 400);
  return value;
}

