// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertSameOrigin, readJson, securityHeaders } from "@/lib/security";
describe("Proteções HTTP", () => {
  it("bloqueia CSRF e origens não autorizadas", () => {
    expect(() =>
      assertSameOrigin(
        new Request("https://example.invalid/api/test", {
          headers: { origin: "https://attacker.invalid" },
        }),
        "https://example.invalid",
      ),
    ).toThrow();
    expect(() =>
      assertSameOrigin(
        new Request("https://example.invalid/api/test", {
          headers: { origin: "https://example.invalid" },
        }),
        "https://example.invalid",
      ),
    ).not.toThrow();
  });
  it("limita o corpo inclusive sem Content-Length", async () => {
    await expect(
      readJson(
        new Request("https://example.invalid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ large: "x".repeat(20000) }),
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      readJson(
        new Request("https://example.invalid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{invalid",
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("usa nonce em produção e HSTS somente com HTTPS", () => {
    const headers = securityHeaders(new Request("https://example.invalid"), "nonce-test", true);
    expect(headers.get("Content-Security-Policy")).toContain("'nonce-nonce-test'");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Strict-Transport-Security")).toBeTruthy();
    expect(
      securityHeaders(new Request("http://localhost"), "nonce", false).has(
        "Strict-Transport-Security",
      ),
    ).toBe(false);
  });
});
