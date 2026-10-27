import { parseQuantityText, saleLineGrossCents } from '@retail/shared-types';
import type { CostVersion } from '@retail/shared-types';
import { formatAppDate } from '../../core/i18n/date-format';

export function bucharestDate(value:string, _locale?:string):string {
  return formatAppDate(value);
}

export function latestEffectiveCost(versions:CostVersion[], now=Date.now()):CostVersion|undefined {
  return versions.filter(c=>new Date(c.effectiveAt).getTime()<=now).sort((a,b)=>new Date(b.effectiveAt).getTime()-new Date(a.effectiveAt).getTime()||new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime())[0];
}

export function moneyCents(text: string): number | undefined {
  const normalized = text.trim().replace(',', '.');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return undefined;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= 99_999_999 ? cents : undefined;
}

/** Resolve a Romanian calendar day to midnight independently of host timezone/DST. */
export function bucharestMidnight(day: string): string {
  const noon = new Date(`${day}T00:00:00Z`);
  const offset = new Intl.DateTimeFormat('en', {timeZone:'Europe/Bucharest',timeZoneName:'longOffset'}).formatToParts(noon).find(p=>p.type==='timeZoneName')!.value.replace('GMT','');
  return `${day}T00:00:00${offset}`;
}

export function lineCents(quantity: number, unitPriceCents: number): number {
  return quantity === 0 ? 0 : saleLineGrossCents(quantity, unitPriceCents);
}

export function quantity(text: string): number | undefined {
  const value = parseQuantityText(text);
  return value !== undefined && value > 0 && value <= 1_000_000 ? value : undefined;
}

export function scenarioPoint(q: number, price: number, cost: number, fixed: number) {
  const revenue = lineCents(q, price);
  const totalCost = lineCents(q, cost) + fixed;
  return { quantity: q, revenue, totalCost, profit: revenue - totalCost };
}

export function breakEven(price: number, cost: number, fixed: number, pieces: boolean): number | null {
  if (price <= cost) return null;
  const step = pieces ? 1000n : 1n;
  const numerator = BigInt(fixed) * 1000n;
  const divisor = BigInt(price - cost) * step;
  return Number(((numerator + divisor - 1n) / divisor) * step) / 1000;
}
