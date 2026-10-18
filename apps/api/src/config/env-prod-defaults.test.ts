import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "./env";

/**
 * TICKET-103 (SEC-004): in production, @retail/env must refuse to start when a
 * credential matches a well-known development default (e.g. someone copies
 * .env.example to a production host). Non-production environments keep the
 * dev defaults so local dev and CI keep working unchanged.
 */

describe("config/env production dev-default guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("refuses to start in production with a known dev-default credential", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("POSTGRES_APP_PASSWORD", "retail-app-dev-password");
    // Other credentials must be non-dev so the failure is attributable.
    vi.stubEnv("POSTGRES_MIGRATE_PASSWORD", "prod-strong-migrate-1");
    vi.stubEnv("KEYCLOAK_ADMIN_PASSWORD", "prod-strong-admin-1");
    vi.stubEnv("KEYCLOAK_ONBOARDING_CLIENT_SECRET", "prod-strong-onboarding-1");

    loadEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    const message = String(errorSpy.mock.calls[0]?.[0] ?? "");
    expect(message).toContain("POSTGRES_APP_PASSWORD");
    expect(message).toContain("development default");
  });

  it("starts cleanly in production with real credentials", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("POSTGRES_PASSWORD", "prod-strong-root-1");
    vi.stubEnv("POSTGRES_APP_PASSWORD", "prod-strong-app-1");
    vi.stubEnv("POSTGRES_MIGRATE_PASSWORD", "prod-strong-migrate-1");
    vi.stubEnv("KEYCLOAK_ADMIN_PASSWORD", "prod-strong-admin-1");
    vi.stubEnv("KEYCLOAK_ONBOARDING_CLIENT_SECRET", "prod-strong-onboarding-1");

    const parsed = loadEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(parsed.NODE_ENV).toBe("production");
    expect(parsed.POSTGRES_APP_PASSWORD).toBe("prod-strong-app-1");
  });

  it("does not apply the guard outside production", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("POSTGRES_APP_PASSWORD", "retail-app-dev-password");
    vi.stubEnv("POSTGRES_MIGRATE_PASSWORD", "retail-migrate-dev-password");

    const parsed = loadEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(parsed.NODE_ENV).toBe("development");
    expect(parsed.POSTGRES_APP_PASSWORD).toBe("retail-app-dev-password");
  });
});
