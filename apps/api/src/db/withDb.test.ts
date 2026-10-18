import { describe, expect, it } from "vitest";
import { quoteIdent } from "./withDb";

describe("quoteIdent", () => {
  it("quotes valid identifiers", () => {
    expect(quoteIdent("t_acme")).toBe('"t_acme"');
    expect(quoteIdent("t_acme_corp")).toBe('"t_acme_corp"');
  });

  it("rejects identifiers that could break out of quoting", () => {
    expect(() => quoteIdent('t_acme"; DROP SCHEMA t_other; --')).toThrow(/Unsafe SQL identifier/);
    expect(() => quoteIdent("t acme")).toThrow(/Unsafe SQL identifier/);
    expect(() => quoteIdent("T_ACME")).toThrow(/Unsafe SQL identifier/);
    expect(() => quoteIdent("")).toThrow(/Unsafe SQL identifier/);
  });
});
