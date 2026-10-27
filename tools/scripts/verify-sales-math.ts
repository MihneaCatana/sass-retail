import assert from 'node:assert/strict';
import { saleLineGrossCents, saleReturnAllocationCents } from '../../packages/shared-types/src';

assert.equal(saleLineGrossCents(0.25, 1500), 375);
assert.equal(saleLineGrossCents(0.005, 100), 1);
assert.equal(saleLineGrossCents(0.001, 499), 0);
assert.equal(saleLineGrossCents(0.001, 500), 1);
assert.equal(saleLineGrossCents(1.001, 1234), 1235);
assert.throws(() => saleLineGrossCents(0.0001, 100));
assert.throws(() => saleLineGrossCents(1, 1.5));
assert.throws(() => saleLineGrossCents(-1, 100));
assert.throws(() => saleLineGrossCents(1, Number.NaN));
assert.throws(() => saleReturnAllocationCents(100, 1, 0.75, 0.5));
for (const cents of [0, 1, 2, 99, 100, 1001]) {
  const parts = [0, 1, 2].map((prior) => saleReturnAllocationCents(cents, 3, prior, 1));
  assert.equal(parts.reduce((total, amount) => total + amount, 0), cents);
}
assert.equal(saleReturnAllocationCents(101, 1.5, 0, 0.25), 17);
assert.equal(saleReturnAllocationCents(101, 1.5, 0.25, 1.25), 84);
console.log('Sales exact-money and cumulative-return arithmetic checks passed.');
