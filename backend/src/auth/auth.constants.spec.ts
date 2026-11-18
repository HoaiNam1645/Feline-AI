import { assertValidPassword, normalizeEmail } from "./auth.constants";

describe("auth constants", () => {
  it("normalizes email addresses", () => {
    expect(normalizeEmail("  Admin@Example.COM ")).toBe("admin@example.com");
  });

  it("requires a strong password without changing its characters", () => {
    expect(() => assertValidPassword("12345678")).not.toThrow();
    expect(() => assertValidPassword("1234567")).toThrow("8");
    expect(() => assertValidPassword("alllowercase2026")).not.toThrow();
  });
});
