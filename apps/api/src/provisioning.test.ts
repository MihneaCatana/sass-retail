import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, SLUG_RE, schemaNameFor } from "@retail/provisioning";

describe("tenant slug validation", () => {
  it("accepts valid slugs", () => {
    expect(SLUG_RE.test("acme")).toBe(true);
    expect(SLUG_RE.test("acme-corp")).toBe(true);
    expect(SLUG_RE.test("abc")).toBe(true);
  });

  it("rejects invalid slugs", () => {
    expect(SLUG_RE.test("Acme")).toBe(false);
    expect(SLUG_RE.test("-acme")).toBe(false);
    expect(SLUG_RE.test("acme-")).toBe(false);
    expect(SLUG_RE.test("ab")).toBe(false);
    expect(SLUG_RE.test("a1")).toBe(false);
    expect(SLUG_RE.test("acme_corp")).toBe(false);
  });

  it("derives schema names from slugs", () => {
    expect(schemaNameFor("acme-corp")).toBe("t_acme_corp");
    expect(schemaNameFor("acme")).toBe("t_acme");
  });

  it("refuses to derive schemas from hostile slugs", () => {
    expect(() => schemaNameFor("acme; DROP SCHEMA t_x")).toThrow();
  });

  it("reserves infrastructure subdomains", () => {
    expect(RESERVED_SLUGS.has("api")).toBe(true);
    expect(RESERVED_SLUGS.has("keycloak")).toBe(true);
  });
});
