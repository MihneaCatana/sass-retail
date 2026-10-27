import { describe, expect, it } from 'vitest';
import { draftSchema, returnSchema, costSchema, validDay, validProductFilter, parse, SalesError } from './sales.validation';

const id = 'a9011e2b-148c-4b2c-9b69-cc365101d17a';
const line = { productId: id, quantity: 0.125, unitPriceCents: 100, discountCents: 0 };
describe('sales boundary validation', () => {
  it('validates optional product drilldown ids before querying', () => {
    expect(validProductFilter(undefined)).toBeUndefined();
    expect(validProductFilter(id)).toBe(id);
    expect(() => validProductFilter('not-a-uuid')).toThrow('INVALID_SALES_INPUT');
  });
  it('accepts exact measured quantities and explicit unknown tax basis', () => {
    expect(parse(draftSchema, { lines: [line], priceBasis: 'unspecified' }).lines[0].quantity).toBe(0.125);
  });
  it.each([0.0001, -1, Infinity, NaN])('rejects invalid quantity %s with stable input error', (quantity) => {
    expect(() => parse(draftSchema, { lines: [{ ...line, quantity }], priceBasis: 'tax_exclusive' })).toThrow(SalesError);
  });
  it('rejects duplicate products, excessive discounts and guessed bases', () => {
    for (const input of [
      { lines: [line, line], priceBasis: 'unspecified' },
      { lines: [{ ...line, discountCents: 14 }], priceBasis: 'tax_exclusive' },
      { lines: [line], priceBasis: 'automatic' }
    ]) expect(() => parse(draftSchema, input)).toThrow('INVALID_SALES_INPUT');
  });
  it('requires explicit restock decisions and nonblank return reasons', () => {
    const input = { lines: [{ saleLineId: id, quantity: 1, restock: false }], reason: 'Damaged item', idempotencyKey: id };
    expect(parse(returnSchema, input).lines[0].restock).toBe(false);
    expect(() => parse(returnSchema, { ...input, reason: ' ' })).toThrow(SalesError);
    expect(() => parse(returnSchema, { ...input, lines: [...input.lines, ...input.lines] })).toThrow(SalesError);
  });
  it('validates real calendar dates and version instants', () => {
    expect(validDay('2024-02-29')).toBe('2024-02-29');
    expect(() => validDay('2025-02-29')).toThrow(SalesError);
    expect(() => parse(costSchema, { unitCostCents: 10, priceBasis: 'tax_exclusive', effectiveAt: 'tomorrow', source: 'estimate' })).toThrow(SalesError);
  });
});
