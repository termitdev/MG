// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import { turnstileSettings, verifyTurnstile } from "@/services/backend/turnstile.server";
import { handleApi } from "@/services/backend/api.server";
const origin = "https://mugui.example.invalid";
const request = (base = origin) => new Request(base + "/api/booking");
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv(
    "APP_DEV_ORIGINS",
    "http://localhost:8082,http://192.168.0.217:8082,http://192.168.0.217.evil.invalid:8082",
  );
  vi.stubEnv("TURNSTILE_SITE_KEY", "synthetic-production-site-key");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "synthetic-private-secret");
  vi.stubEnv("TURNSTILE_LOCAL_TEST_MODE", "true");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ success: true, hostname: "mugui.example.invalid", action: "booking" }),
    ),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Turnstile server verification", () => {
  it("production requires successful Siteverify, the expected hostname and booking action", async () => {
    await verifyTurnstile(request(), "valid-synthetic-token");
    expect(fetch).toHaveBeenCalledTimes(1);
    const init = vi.mocked(fetch).mock.calls[0]![1]!;
    expect((init.body as URLSearchParams).get("secret")).toBe("synthetic-private-secret");
    for (const result of [
      { success: false, "error-codes": ["invalid-input-response"] },
      { success: false, "error-codes": ["timeout-or-duplicate"] },
      { success: true, hostname: "attacker.invalid", action: "booking" },
      { success: true, hostname: "mugui.example.invalid", action: "other" },
    ]) {
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(result));
      await expect(verifyTurnstile(request(), "synthetic-token")).rejects.toMatchObject({
        status: 400,
        code: "TURNSTILE_REJECTED",
      });
    }
  });
  it("never accepts dummy tokens or official test credentials in production", async () => {
    await expect(verifyTurnstile(request(), "XXXX.DUMMY.TOKEN.XXXX")).rejects.toMatchObject({
      status: 400,
    });
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    expect(() => turnstileSettings(request())).toThrow();
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv("TURNSTILE_SECRET_KEY", "synthetic-private-secret");
    vi.stubEnv("TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    expect(() => turnstileSettings(request())).toThrow();
  });
  it("selects a matching official pair only for trusted local development and still calls Siteverify", async () => {
    vi.stubEnv("NODE_ENV", "development");
    for (const base of ["http://localhost:8082", "http://192.168.0.217:8082"]) {
      expect(turnstileSettings(request(base))).toMatchObject({
        localTest: true,
        siteKey: "1x00000000000000000000AA",
      });
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ success: true, hostname: "example.com", "error-codes": [] }),
      );
      await verifyTurnstile(request(base), "XXXX.DUMMY.TOKEN.XXXX");
    }
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ success: false, "error-codes": ["invalid-input-response"] }),
    );
    await expect(
      verifyTurnstile(request("http://localhost:8082"), "XXXX.DUMMY.TOKEN.XXXX"),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      verifyTurnstile(request("http://localhost:8082"), "arbitrary-string"),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("does not choose local keys for public hosts, hostname imitations or disabled local test mode", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(turnstileSettings(request()).localTest).toBe(false);
    expect(turnstileSettings(request("http://192.168.0.217.evil.invalid:8082")).localTest).toBe(
      false,
    );
    expect(turnstileSettings(request("http://localhost:9999")).localTest).toBe(false);
    vi.stubEnv("TURNSTILE_LOCAL_TEST_MODE", "false");
    expect(turnstileSettings(request("http://localhost:8082")).localTest).toBe(false);
  });
  it("keeps provider/network failures distinct from invalid tokens and never exposes secrets", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("synthetic private transport details"));
    await expect(verifyTurnstile(request(), "synthetic-token")).rejects.toMatchObject({
      status: 503,
      code: "TURNSTILE_UNAVAILABLE",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ success: false, "error-codes": ["invalid-input-secret"] }),
    );
    await expect(verifyTurnstile(request(), "synthetic-token")).rejects.toMatchObject({
      status: 500,
      code: "TURNSTILE_CONFIGURATION_ERROR",
    });
    const response = await handleApi(new Request(origin + "/api/config"));
    const text = await response.text();
    expect(text).toContain("synthetic-production-site-key");
    expect(text).not.toContain("synthetic-private-secret");
  });
});
