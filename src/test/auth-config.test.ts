// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import { inspectAuthConfiguration } from "@/lib/backend-config";
import { assertApplicationOrigin, applicationOrigin } from "@/services/backend/origin.server";
const values = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_synthetic",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_synthetic",
};
const jwt = (claims: unknown) =>
  "e30." + Buffer.from(JSON.stringify(claims)).toString("base64url") + ".synthetic";
afterEach(() => vi.unstubAllEnvs());
describe("Backend configuration and origin boundaries", () => {
  it("accepts modern keys and validates legacy key roles and project", () => {
    expect(inspectAuthConfiguration(values, true)).toEqual([]);
    expect(
      inspectAuthConfiguration(
        {
          ...values,
          SUPABASE_ANON_KEY: jwt({ role: "anon", ref: "project" }),
          SUPABASE_SERVICE_ROLE_KEY: jwt({ role: "service_role", ref: "project" }),
        },
        true,
      ),
    ).toEqual([]);
    const result = inspectAuthConfiguration(
      { ...values, SUPABASE_SERVICE_ROLE_KEY: jwt({ role: "anon", ref: "other" }) },
      true,
    );
    expect(result).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("e30.");
  });
  it("rejects remote HTTP, malformed URL, missing keys and expired keys", () => {
    expect(
      inspectAuthConfiguration({ ...values, SUPABASE_URL: "http://project.supabase.co" }),
    ).not.toEqual([]);
    expect(inspectAuthConfiguration({ ...values, SUPABASE_URL: "invalid" })).not.toEqual([]);
    expect(inspectAuthConfiguration({ SUPABASE_URL: values.SUPABASE_URL })).not.toEqual([]);
    expect(
      inspectAuthConfiguration({ ...values, SUPABASE_ANON_KEY: jwt({ role: "anon", exp: 1 }) }),
    ).not.toEqual([]);
  });
  it("allows local Supabase HTTP only in development", () => {
    expect(
      inspectAuthConfiguration({
        ...values,
        SUPABASE_URL: "http://127.0.0.1:54321",
        NODE_ENV: "development",
      }),
    ).toEqual([]);
    expect(
      inspectAuthConfiguration({
        ...values,
        SUPABASE_URL: "http://127.0.0.1:54321",
        NODE_ENV: "production",
      }),
    ).not.toEqual([]);
  });
  it("accepts the exact local listener without trusting arbitrary Host or forwarded headers", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ORIGIN", "http://mugui.example.invalid");
    vi.stubEnv("APP_DEV_ORIGINS", "http://192.168.0.217:8082,http://localhost:8082");
    const r = new Request("http://192.168.0.217:8082/api/auth/login", {
      headers: { origin: "http://192.168.0.217:8082" },
    });
    expect(() => assertApplicationOrigin(r)).not.toThrow();
    expect(applicationOrigin(r)).toBe("http://192.168.0.217:8082");
    expect(() =>
      assertApplicationOrigin(
        new Request("http://evil.invalid/api/auth/login", {
          headers: { origin: "http://evil.invalid", "x-forwarded-host": "192.168.0.217:8082" },
        }),
      ),
    ).toThrow();
    expect(() =>
      assertApplicationOrigin(new Request(r.url, { headers: { origin: "http://localhost:8082" } })),
    ).toThrow();
    expect(() =>
      assertApplicationOrigin(
        new Request(r.url, {
          headers: { origin: "http://192.168.0.217:8082", "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toThrow();
  });
  it("production ignores all local allowances and requires HTTPS", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://mugui.example.invalid");
    vi.stubEnv("APP_DEV_ORIGINS", "http://localhost:8082");
    expect(() =>
      assertApplicationOrigin(
        new Request("http://localhost:8082/api/auth/login", {
          headers: { origin: "http://localhost:8082" },
        }),
      ),
    ).toThrow();
    expect(() =>
      assertApplicationOrigin(
        new Request("https://mugui.example.invalid/api/auth/login", {
          headers: { origin: "https://mugui.example.invalid" },
        }),
      ),
    ).not.toThrow();
    vi.stubEnv("APP_ORIGIN", "http://mugui.example.invalid");
    expect(() => applicationOrigin()).toThrow();
  });
});
