/**
 * Shared DTOs and enums used by both @retail/api and @retail/web.
 * This package is the single source of truth for API contracts.
 */

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
  recentAuditEntries: TenantAuditEntry[];
}


