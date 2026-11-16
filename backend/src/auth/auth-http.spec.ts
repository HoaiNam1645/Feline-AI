import { hashSessionToken, readCookie, sessionCookie } from "./auth-http";

describe("auth HTTP helpers", () => {
  it("hashes session tokens deterministically without retaining the token", () => {
    const hash = hashSessionToken("secret-session-token");
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashSessionToken("secret-session-token"));
    expect(hash).not.toContain("secret-session-token");
  });

  it("creates a strict HttpOnly cookie and reads it back", () => {
    const cookie = sessionCookie("feline_session", "token value", 3600, true);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
    expect(readCookie({ headers: { cookie: "other=x; feline_session=token%20value" } } as never, "feline_session"))
      .toBe("token value");
  });
});
