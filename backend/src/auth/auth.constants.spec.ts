import { assertValidPassword, normalizeEmail } from "./auth.constants";

describe("auth constants", () => {
  it("normalizes email addresses", () => {
    expect(normalizeEmail("  Admin@Example.COM ")).toBe("admin@example.com");
  });

  it("requires a strong password without changing its characters", () => {
    expect(() => assertValidPassword("StrongPassword2026")).not.toThrow();
    expect(() => assertValidPassword("short1A")).toThrow("12");
    expect(() => assertValidPassword("alllowercase2026")).toThrow("chữ hoa");
  });
});
