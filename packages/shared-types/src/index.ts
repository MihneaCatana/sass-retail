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
