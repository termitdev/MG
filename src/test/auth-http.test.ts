// @vitest-environment node
// Real BFF and Supabase SDK, with provider HTTP intercepted; no remote accounts or email.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import { handleApi } from "@/services/backend/api.server";

const origin = "https://mugui.example.invalid";
const id = "10000000-0000-4000-8000-000000000001";
const createdId = "10000000-0000-4000-8000-000000000002";
let role = "staff",
  active = true,
  aal = "aal1",
  expired = false;
let authFailure = "",
  profileFailure = "",
  emailFailure = false;
let pending = false,
  duplicate = false,
  partialFailure = false,
  confirmed = false;
let passwordFailure = "",
  completionFailure = false;
const calls: { path: string; body: Record<string, unknown> }[] = [];
function user(userId = id) {
  return {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "synthetic@example.invalid",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
}
function session() {
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, role: "authenticated", aal, exp: Math.floor(Date.now() / 1000) + (expired ? -60 : 3600) })}.${Buffer.from("synthetic-signature").toString("base64url")}`;
  return {
    access_token: token,
    refresh_token: "synthetic-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + (expired ? -60 : 3600),
    token_type: "bearer",
    user: user(),
  };
}
function cookies() {
  return `sb-project-auth-token=base64-${Buffer.from(JSON.stringify(session())).toString("base64url")}`;
}
function request(path: string, body?: unknown, authenticated = false, base = origin) {
  return new Request(base + "/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { origin: base, "Content-Type": "application/json" }),
      ...(authenticated ? { cookie: cookies() } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  role = "staff";
  active = true;
  aal = "aal1";
  expired = false;
  authFailure = "";
  profileFailure = "";
  emailFailure = false;
  pending = false;
  duplicate = false;
  partialFailure = false;
  confirmed = false;
  passwordFailure = "";
  completionFailure = false;
  calls.length = 0;
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("APP_DEV_ORIGINS", "http://192.168.0.217:8082,http://localhost:8082");
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_ANON_KEY", "sb_publishable_synthetic");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_synthetic");
  vi.stubEnv("DATA_HMAC_KEY", "synthetic-hmac-key-with-over-32-characters");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      );
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      calls.push({ path: u.pathname + u.search, body });
      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { "Content-Type": "application/json", "x-supabase-api-version": "2024-01-01" },
        });
      if (u.pathname === "/rest/v1/rpc/consume_rate_limit") return json(true);
      if (u.pathname === "/auth/v1/token" && authFailure)
        return json(
          { code: authFailure, msg: "provider details must not escape" },
          authFailure === "invalid_credentials" ? 400 : 503,
        );
      if (u.pathname === "/auth/v1/token") {
        expired = false;
        return json(session());
      }
      if (u.pathname === "/auth/v1/user") {
        if (init?.method === "PUT" && passwordFailure)
          return json({ code: passwordFailure, message: "private password details" }, 400);
        if (authFailure)
          return json(
            { code: authFailure, msg: "provider private details" },
            authFailure === "bad_jwt" ? 401 : 503,
          );
        return json(user());
      }
      if (u.pathname === "/auth/v1/logout") return new Response(null, { status: 204 });
      if (u.pathname === "/rest/v1/profiles") {
        const target = u.searchParams.get("id") === "eq." + createdId;
        if (profileFailure) return json({ code: profileFailure, message: "private DB error" }, 503);
        return json([
          {
            id,
            full_name: "Synthetic",
            email: "synthetic@example.invalid",
            role,
            active,
            can_view_sensitive: false,
            invitation_pending: target || pending,
          },
        ]);
      }
      if (u.pathname === "/auth/v1/admin/users")
        return json({ ...user(createdId), email_confirmed_at: new Date().toISOString() });
      if (u.pathname === "/auth/v1/admin/users/" + createdId)
        return json({
          ...user(createdId),
          invited_at: new Date().toISOString(),
          email_confirmed_at: confirmed ? new Date().toISOString() : undefined,
        });
      if (u.pathname === "/auth/v1/admin/users/" + id)
        return json({
          ...user(),
          invited_at: new Date().toISOString(),
          email_confirmed_at: confirmed ? new Date().toISOString() : undefined,
        });
      if (u.pathname === "/rest/v1/rpc/find_staff_account")
        return json(duplicate ? [{ id: createdId }] : []);
      if (u.pathname === "/rest/v1/rpc/register_staff_invitation")
        return partialFailure ? json({ message: "private DB error" }, 503) : json(null);
      if (u.pathname === "/rest/v1/rpc/complete_staff_invitation") {
        if (completionFailure) return json({ message: "private completion failure" }, 503);
        pending = false;
        return json(null);
      }
      if (u.pathname === "/auth/v1/invite")
        return json(
          emailFailure
            ? { message: "SMTP private details" }
            : { ...user(pending ? id : createdId), invited_at: new Date().toISOString() },
          emailFailure ? 503 : 200,
        );
      if (u.pathname === "/auth/v1/verify")
        return authFailure ? json({ message: "private expired link" }, 403) : json(session());
      if (u.pathname === "/rest/v1/rpc/manage_staff_profile") return json(null);
      if (u.pathname === "/auth/v1/recover")
        return json(
          emailFailure ? { message: "SMTP private details" } : {},
          emailFailure ? 503 : 200,
        );
      if (u.pathname === "/rest/v1/audit_logs") return new Response(null, { status: 201 });
      throw new Error("Unexpected synthetic provider endpoint: " + u.pathname);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Auth HTTP with real Supabase SDK", () => {
  it("returns 401 for no session without calling the provider", async () => {
    expect((await handleApi(request("auth/session"))).status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it("uses the provider-validated user and active profile", async () => {
    const response = await handleApi(request("auth/session", undefined, true));
    expect(response.status).toBe(200);
    expect((await response.json()).profile.id).toBe(id);
    expect(calls.some((c) => c.path === "/auth/v1/user")).toBe(true);
  });
  it("refreshes expired sessions and returns refreshed HttpOnly cookies", async () => {
    expired = true;
    const response = await handleApi(request("auth/session", undefined, true));
    expect(response.status).toBe(200);
    expect(calls.some((c) => c.path.includes("grant_type=refresh_token"))).toBe(true);
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
  });
  it("returns 401 for an invalid token and 403 for an inactive account", async () => {
    authFailure = "bad_jwt";
    expect((await handleApi(request("auth/session", undefined, true))).status).toBe(401);
    authFailure = "";
    active = false;
    expect((await handleApi(request("auth/session", undefined, true))).status).toBe(403);
  });
  it("separates provider outage and missing schema without leaking details", async () => {
    authFailure = "unexpected_failure";
    let response = await handleApi(request("auth/session", undefined, true));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private");
    authFailure = "";
    profileFailure = "42P01";
    response = await handleApi(request("auth/session", undefined, true));
    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe("BACKEND_CONFIGURATION_ERROR");
  });
  it("logs in and uses secure, host-only cookies for production HTTPS", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await handleApi(
      request("auth/login", { email: "synthetic@example.invalid", password: "personal-password" }),
    );
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(cookie).not.toMatch(/Domain=/i);
    expect(await response.text()).not.toContain("access_token");
  });
  it("supports local HTTP cookies but refuses external CSRF", async () => {
    const response = await handleApi(
      request(
        "auth/login",
        { email: "synthetic@example.invalid", password: "personal-password" },
        false,
        "http://192.168.0.217:8082",
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).not.toMatch(/; Secure/i);
    const bad = new Request(origin + "/api/auth/login", {
      method: "POST",
      headers: { origin: "https://attacker.invalid", "Content-Type": "application/json" },
      body: "{}",
    });
    const count = calls.length;
    expect((await handleApi(bad)).status).toBe(403);
    expect(calls.length).toBe(count);
  });
  it("rejects wrong credentials without exposing provider errors", async () => {
    authFailure = "invalid_credentials";
    const response = await handleApi(
      request("auth/login", { email: "synthetic@example.invalid", password: "incorrect" }),
    );
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("provider details");
  });
  it("staff cannot create accounts; AAL1 admin cannot bypass MFA", async () => {
    expect((await handleApi(request("users", {}, true))).status).toBe(403);
    role = "admin";
    expect((await handleApi(request("users", {}, true))).status).toBe(403);
    expect(calls.some((c) => c.path === "/auth/v1/admin/users")).toBe(false);
  });
  it("invites only after AAL2 admin validation and stores permissions without a recovery email", async () => {
    role = "admin";
    aal = "aal2";
    const response = await handleApi(
      request(
        "users",
        {
          full_name: "Synthetic Staff",
          email: "staff@example.invalid",
          role: "staff",
          active: true,
          can_view_sensitive: false,
        },
        true,
      ),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).invitationSent).toBe(true);
    const create = calls.find((c) => c.path.startsWith("/auth/v1/invite"))!;
    expect(create.path).toContain(encodeURIComponent(origin + "/auth/callback"));
    expect(create.body).not.toHaveProperty("password");
    expect(create.body).not.toHaveProperty("role");
    expect(
      calls.findIndex((c) => c.path === "/rest/v1/rpc/register_staff_invitation"),
    ).toBeGreaterThan(calls.indexOf(create));
    expect(
      calls.some(
        (c) =>
          c.path.includes("signup") ||
          c.path.includes("recover") ||
          c.path === "/auth/v1/admin/users",
      ),
    ).toBe(false);
  });
  it("does not claim email delivery when SMTP fails, without losing the created account", async () => {
    role = "admin";
    aal = "aal2";
    emailFailure = true;
    const response = await handleApi(
      request(
        "users",
        {
          full_name: "Synthetic Staff",
          email: "staff@example.invalid",
          role: "staff",
          active: true,
          can_view_sensitive: false,
        },
        true,
      ),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private");
    expect(calls.some((c) => c.path.includes("register_staff_invitation"))).toBe(false);
  });
  it("rejects duplicate email before sending and keeps partial failures explicit", async () => {
    role = "admin";
    aal = "aal2";
    duplicate = true;
    const body = {
      full_name: "Synthetic Staff",
      email: "staff@example.invalid",
      role: "staff",
      active: true,
      can_view_sensitive: false,
    };
    expect((await handleApi(request("users", body, true))).status).toBe(409);
    expect(calls.some((c) => c.path.includes("/invite"))).toBe(false);
    duplicate = false;
    partialFailure = true;
    const response = await handleApi(request("users", body, true));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("STAFF_INVITATION_INCOMPLETE");
  });
  it("blocks pending sessions from data routes until the password is saved", async () => {
    pending = true;
    expect((await handleApi(request("auth/session", undefined, true))).status).toBe(200);
    expect((await handleApi(request("requests/search", {}, true))).status).toBe(403);
    expect((await handleApi(request("auth/password", { password: "short" }, true))).status).toBe(
      400,
    );
    expect(pending).toBe(true);
    const response = await handleApi(
      request("auth/password", { password: "synthetic-personal-password" }, true),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).profile.invitation_pending).toBe(false);
    expect(calls.some((c) => c.path.includes("complete_staff_invitation"))).toBe(true);
  });
  it("can safely finish after Auth saved the password but profile completion failed", async () => {
    pending = true;
    completionFailure = true;
    const input = { password: "synthetic-personal-password" };
    expect((await handleApi(request("auth/password", input, true))).status).toBe(400);
    expect(pending).toBe(true);
    completionFailure = false;
    passwordFailure = "same_password";
    expect((await handleApi(request("auth/password", input, true))).status).toBe(200);
    expect(pending).toBe(false);
  });
  it("accepts an invitation with validated provider session and rejects invalid/used sessions", async () => {
    pending = true;
    const response = await handleApi(
      request("auth/accept-invite", {
        access_token: session().access_token,
        refresh_token: "synthetic-refresh-token",
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    pending = false;
    expect(
      (
        await handleApi(
          request("auth/accept-invite", {
            access_token: session().access_token,
            refresh_token: "synthetic-refresh-token",
          }),
        )
      ).status,
    ).toBe(409);
    authFailure = "bad_jwt";
    expect(
      (
        await handleApi(
          request("auth/accept-invite", {
            access_token: session().access_token,
            refresh_token: "synthetic-refresh-token",
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("rejects expired one-time links and never grants access to inactive invitees", async () => {
    authFailure = "expired";
    expect(
      (
        await handleApi(
          request("auth/verify-link", {
            token_hash: "synthetic-expired-one-time-token",
            type: "invite",
          }),
        )
      ).status,
    ).toBe(400);
    authFailure = "";
    pending = true;
    active = false;
    expect(
      (await handleApi(request("auth/password", { password: "synthetic-personal-password" }, true)))
        .status,
    ).toBe(403);
    expect(pending).toBe(true);
  });
  it("resends only pending unconfirmed invitations and keeps recovery separate", async () => {
    role = "admin";
    aal = "aal2";
    expect((await handleApi(request("users/invitation/resend", { id }, true))).status).toBe(409);
    expect(
      (await handleApi(request("users/invitation/resend", { id: createdId }, true))).status,
    ).toBe(200);
    confirmed = true;
    expect(
      (await handleApi(request("users/invitation/resend", { id: createdId }, true))).status,
    ).toBe(409);
    expect((await handleApi(request("users/password-setup", { id: createdId }, true))).status).toBe(
      409,
    );
    expect(
      (await handleApi(request("auth/recover", { email: "synthetic@example.invalid" }))).status,
    ).toBe(200);
    expect(calls.some((c) => c.path.startsWith("/auth/v1/recover"))).toBe(true);
  });
  it("preserves administrator invitations and privileged fields only in the backend RPC", async () => {
    role = "admin";
    aal = "aal2";
    const response = await handleApi(
      request(
        "users",
        {
          full_name: "Invited Admin",
          email: "admin-test@example.invalid",
          role: "admin",
          active: true,
          can_view_sensitive: true,
        },
        true,
      ),
    );
    expect(response.status).toBe(200);
    expect(calls.find((c) => c.path.includes("register_staff_invitation"))?.body).toMatchObject({
      p_role: "admin",
      p_sensitive: true,
    });
    expect(calls.find((c) => c.path.startsWith("/auth/v1/invite"))?.body).toEqual({
      email: "admin-test@example.invalid",
      data: { full_name: "Invited Admin", mugui_invitation: true },
    });
  });
  it("logout removes cookies and asks Auth to revoke refresh sessions", async () => {
    const response = await handleApi(request("auth/logout", {}, true));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
    expect(calls.some((c) => c.path === "/auth/v1/logout?scope=global")).toBe(true);
  });
  it("returns a configuration error before provider calls when the backend is missing", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await handleApi(request("auth/session"));
      expect(response.status).toBe(500);
      expect((await response.json()).code).toBe("BACKEND_CONFIGURATION_ERROR");
      expect(calls).toHaveLength(0);
    } finally {
      log.mockRestore();
    }
  });
  it("does not allow a service-role field containing an anon key to create accounts", async () => {
    role = "admin";
    aal = "aal2";
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_publishable_not-administrative");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await handleApi(request("users", {}, true));
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("sb_publishable");
      expect(calls.some((c) => c.path === "/auth/v1/admin/users")).toBe(false);
    } finally {
      log.mockRestore();
    }
  });
  it("blocks self-modification and mismatched account email", async () => {
    role = "admin";
    aal = "aal2";
    const payload = {
      full_name: "Synthetic Staff",
      email: "synthetic@example.invalid",
      role: "staff",
      active: false,
      can_view_sensitive: false,
    };
    expect((await handleApi(request("users", { ...payload, id }, true))).status).toBe(403);
    const response = await handleApi(
      request("users", { ...payload, id: createdId, email: "another@example.invalid" }, true),
    );
    expect(response.status).toBe(409);
    expect(calls.some((c) => c.path === "/rest/v1/rpc/manage_staff_profile")).toBe(false);
  });
});
