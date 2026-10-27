/**
 * Shared DTOs and enums used by both @retail/api and @retail/web.
 * This package is the single source of truth for API contracts.
 */
export * from './sales';
export * from './modules';
import type { WorkspaceModuleKey } from './modules';

export interface HealthStatus {
  status: "ok";
  service: "api";
  version: string;
}

export interface ApiError {
  error: string;
  path?: string;
}

/** Identity of the authenticated caller (`GET /api/me`). */
export interface Me {
  sub: string;
  roles: string[];
  tenantSlug: string | null;
}

/** Tenant resolved for the current request (`GET /api/tenants/current`). */
export interface CurrentTenant {
  tenantId: string;
  slug: string;
  name: string;
}


/**
 * Tenant registry entry as returned by the platform-admin tenant list
 * endpoint (`GET /api/platform/tenants`).
 */
export interface TenantSummary {
  id: string;
  slug: string;
  schemaName: string;
  name: string;
  status: "active" | "suspended";
  plan: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** ISO 8601 timestamp of the last registry update. */
  updatedAt: string;
}

/** One platform audit-log entry, as surfaced to platform admins. */
export interface TenantAuditEntry {
  occurredAt: string;
  actor: string;
  action: string;
  details: Record<string, unknown>;
}

/**
 * Response of `GET /api/platform/tenants/:slug`: the registry entry plus the
 * most recent audit entries referencing that tenant.
 */
export interface TenantDetail {
  tenant: TenantSummary;
  enabledModules: WorkspaceModuleKey[];
  recentAuditEntries: TenantAuditEntry[];
}

/**
 * Product classification enums (shared between API and UI).
 * Extensible lists: the database stores plain text with a default.
 */
export const UNIT_TYPES = ["ml", "l", "g", "kg", "unit"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const PRODUCT_TYPES = ["endproduct", "service", "consumable"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];
export const PRODUCT_SORT_FIELDS = ['name', 'type', 'sku', 'price', 'cost', 'stock', 'updated'] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

/** A tenant-scoped product (TICKET-101): lives in the tenant's own schema. */
export interface Product {
  id: string;
  name: string;
  sku: string;
  /** Price in minor units (cents) — never store float money. */
  priceCents: number;
  stock: number;
  /** How this product is counted (e.g., 'unit', 'kg', 'l'). */
  unitType: UnitType;
  /** How this product is classified (e.g., 'endproduct', 'service'). */
  productType: ProductType;
  /** Latest standard cost already effective today, included for tenant admins in list responses. */
  latestCostCents?: number | null;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** Paginated product list response (`GET /api/products`). */
export interface ProductPage {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export const MOVEMENT_KINDS = ['opening', 'receive', 'consume', 'waste', 'adjust', 'reversal'] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];
export type StockMovementInput = {
  kind: 'receive' | 'consume' | 'waste' | 'adjust';
  quantity: number;
  reason: string;
  idempotencyKey: string;
};
export interface StockMovement {
  id: string;
  productId: string;
  kind: MovementKind;
  delta: number;
  before: number;
  after: number;
  unitType: UnitType;
  reason: string;
  actor: string;
  createdAt: string;
  reversalOf: string | null;
  reversed: boolean;
  saleId?: string | null;
  saleLineId?: string | null;
  saleReturnId?: string | null;
}
export interface StockMovementPage {
  movements: StockMovement[];
  total: number;
  page: number;
  pageSize: number;
}

/** Exact decimal boundary: parse decimal digits into integer thousandths.
 * No binary-float multiplication or rounding is used for quantity arithmetic.
 */
export function quantityToMillis(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const match = /^(-?)(\d+)(?:\.(\d{1,3}))?$/.exec(String(value));
  if (!match) return undefined;
  const millis = Number(match[2]) * 1000 + Number((match[3] ?? '').padEnd(3, '0'));
  return Number.isSafeInteger(millis) ? (match[1] ? -millis : millis) : undefined;
}

/** Text input accepts either a decimal point or the Romanian decimal comma,
 * never grouping separators or scientific notation. */
export function parseQuantityText(value: string): number | undefined {
  const normalized = value.trim().replace(',', '.');
  if (!/^-?\d+(?:\.\d{1,3})?$/.test(normalized)) return undefined;
  const number = Number(normalized);
  return quantityToMillis(number) === undefined ? undefined : number;
}


