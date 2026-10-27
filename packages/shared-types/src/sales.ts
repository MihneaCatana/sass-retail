import { quantityToMillis, type ProductType, type UnitType } from './index';

/** Exact half-up bani rounding shared by server calculations and UI previews. */
export function saleLineGrossCents(quantity: number, unitPriceCents: number): number {
  const millis = quantityToMillis(quantity);
  if (millis === undefined || millis <= 0 || !Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0) {
    throw new Error('Invalid sale quantity or unit price');
  }
  const amount = (BigInt(millis) * BigInt(unitPriceCents) + 500n) / 1000n;
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Sale amount is too large');
  return Number(amount);
}

/** Allocate cumulative rounded totals so all partial returns sum to the original. */
export function saleReturnAllocationCents(totalCents: number, soldQuantity: number,
  alreadyReturnedQuantity: number, returnQuantity: number): number {
  const sold = quantityToMillis(soldQuantity);
  const prior = quantityToMillis(alreadyReturnedQuantity);
  const current = quantityToMillis(returnQuantity);
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || sold === undefined || sold <= 0
    || prior === undefined || prior < 0 || current === undefined || current <= 0 || prior + current > sold) {
    throw new Error('Invalid sale return allocation');
  }
  const cumulative = (quantity: number) => (BigInt(totalCents) * BigInt(quantity) * 2n + BigInt(sold)) / (2n * BigInt(sold));
  return Number(cumulative(prior + current) - cumulative(prior));
}

export const PRICE_BASES = ['unspecified', 'tax_inclusive', 'tax_exclusive'] as const;
export type PriceBasis = (typeof PRICE_BASES)[number];
export type SaleStatus = 'draft' | 'completed' | 'partially_returned' | 'returned' | 'cancelled' | 'discarded';
export interface SaleLineInput {
  productId: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  priceOverrideReason?: string;
}
export interface SaleDraftInput {
  lines: SaleLineInput[];
  priceBasis: PriceBasis;
  note?: string;
  revision?: number;
}
export interface SaleLine extends SaleLineInput {
  id: string;
  name: string;
  sku: string;
  productType: ProductType;
  unitType: UnitType;
  /** Live quantity available while editing a draft; omitted for historical sales. */
  availableStock?: number;
  grossCents: number;
  totalCents: number;
  returnedQuantity: number;
  returnedCents: number;
  costVersionId: string | null;
  unitCostCents: number | null;
  costBasis: PriceBasis | null;
}
export interface SaleReturnLineInput { saleLineId: string; quantity: number; restock: boolean; }
export interface SaleReturnInput { lines: SaleReturnLineInput[]; reason: string; idempotencyKey: string; }
export interface SaleReturn {
  id: string;
  saleId: string;
  kind: 'return' | 'cancel';
  reason: string;
  actor: string;
  createdAt: string;
  totalCents: number;
  lines: Array<SaleReturnLineInput & { amountCents: number }>;
}
export interface Sale {
  id: string;
  reference: string;
  status: SaleStatus;
  revision: number;
  priceBasis: PriceBasis;
  note: string;
  actor: string;
  createdAt: string;
  completedAt: string | null;
  totalCents: number;
  returnedCents: number;
  lines: SaleLine[];
  returns: SaleReturn[];
}
export interface SalePage { sales: Sale[]; total: number; page: number; pageSize: number; }
export interface CostVersionInput {
  unitCostCents: number;
  priceBasis: PriceBasis;
  effectiveAt: string;
  source: 'purchase' | 'production' | 'service' | 'estimate';
  note?: string;
}
export interface CostVersion extends CostVersionInput {
  id: string; productId: string; actor: string; createdAt: string;
}
export interface ProductPerformance {
  productId: string; name: string; sku: string; unitType: UnitType; productType: ProductType;
  quantitySold: number; quantityReturned: number;
  grossSalesCents: number; returnedCents: number; netSalesCents: number;
  coveredSalesCents: number; estimatedCostCents: number | null;
  estimatedProfitCents: number | null; marginPercent: number | null;
}
export interface SalesPerformance {
  products: ProductPerformance[];
  trend: Array<{ date: string; grossSalesCents: number; returnedCents: number; netSalesCents: number }>;
  totalSalesCents: number; returnedCents: number; netSalesCents: number;
  coveredSalesCents: number; costCoveragePercent: number | null;
  estimatedProfitCents: number | null;
  from: string | null; to: string | null;
}

