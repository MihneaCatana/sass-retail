import { afterEach, describe, expect, it, vi } from "vitest";
import { env, requireEnvVar } from "./env";

describe("config/env", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies defaults for optional values", () => {
    expect(env.API_PORT).toBe(3000);
    expect(env.JWT_AUDIENCE).toBe("retail-api");
    expect(["development", "test", "production"]).toContain(env.NODE_ENV);
  });

  it("requireEnvVar passes for present values and exits for missing ones", () => {
    // Present (from .env / setup defaults): must NOT exit.
    requireEnvVar("POSTGRES_APP_PASSWORD");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    (env as Record<string, unknown>).POSTGRES_APP_PASSWORD = "";
    requireEnvVar("POSTGRES_APP_PASSWORD");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("POSTGRES_APP_PASSWORD");
  });
});

