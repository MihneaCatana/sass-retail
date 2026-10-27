import { describe, expect, it } from 'vitest';
import { breakEven, bucharestDate, bucharestMidnight, latestEffectiveCost, lineCents, moneyCents, scenarioPoint } from './sales-utils';
import type { CostVersion } from '@retail/shared-types';
describe('sales scenario arithmetic',()=>{
 it('shows the effective calendar day as dd/MM/yyyy in Bucharest time',()=>{expect(bucharestDate('2026-10-24T21:00:00Z','en-GB')).toBe('25/10/2026');expect(bucharestDate('2026-01-14T22:00:00Z','en-GB')).toBe('15/01/2026');});
 it('selects newest effective cost even when basis is incompatible',()=>{const versions=[{id:'old',effectiveAt:'2026-01-01T00:00:00Z',createdAt:'2026-01-01T00:00:00Z',priceBasis:'tax_exclusive'},{id:'new',effectiveAt:'2026-02-01T00:00:00Z',createdAt:'2026-02-01T00:00:00Z',priceBasis:'tax_inclusive'},{id:'future',effectiveAt:'2027-01-01T00:00:00Z',createdAt:'2026-02-01T00:00:00Z',priceBasis:'tax_exclusive'}] as CostVersion[];expect(latestEffectiveCost(versions,new Date('2026-03-01').getTime())?.id).toBe('new');});
 it('parses bani without floating rounding and rejects excess precision',()=>{expect(moneyCents('1,01')).toBe(101);expect(moneyCents('0.001')).toBeUndefined();expect(moneyCents('-1')).toBeUndefined();});
 it('rounds fractional quantities once and supports explicit zero cost',()=>{expect(lineCents(.125,101)).toBe(13);expect(scenarioPoint(3,101,0,50)).toEqual({quantity:3,revenue:303,totalCost:50,profit:253});});
 it('ceil break even to permitted unit precision and rejects nonpositive contribution',()=>{expect(breakEven(200,100,250,true)).toBe(3);expect(breakEven(200,100,250,false)).toBe(2.5);expect(breakEven(100,100,0,true)).toBeNull();});
 it('uses Romanian winter and summer offsets regardless of host timezone',()=>{expect(bucharestMidnight('2026-01-15')).toBe('2026-01-15T00:00:00+02:00');expect(bucharestMidnight('2026-07-15')).toBe('2026-07-15T00:00:00+03:00');});
});
