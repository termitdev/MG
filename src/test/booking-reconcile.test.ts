// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  limit: true,
  receipt: null as null | { protocol: string; requested_at: string },
  clauses: [] as [string, string][],
  query: vi.fn(),
  bookingError: null as null | { code: string; message: string },
  submitted: 0,
}));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/services/backend/supabase.server", () => ({
  env: (key: string) => process.env[key],
  adminClient: () => ({
    rpc: async (name: string) => {
      if (name === "submit_exam_request") {
        state.submitted++;
        return { data: null, error: state.bookingError };
      }
      return { data: state.limit, error: null };
    },
    from: () => {
      state.query();
      const query = {
        select: () => query,
        eq: (key: string, value: string) => {
          state.clauses.push([key, value]);
          return query;
        },
        maybeSingle: async () => ({ data: state.receipt, error: null }),
      };
      return query;
    },
  }),
  sessionClient: vi.fn(),
  requireAdmin: vi.fn(),
  requireStaff: vi.fn(),
  dbCheck: vi.fn(),
}));
import { handleApi } from "@/services/backend/api.server";
const payload = {
  fullName: "Paciente Sintético",
  documentType: "cpf",
  documentNumber: "529.982.247-25",
  birthDate: "1990-01-01",
  email: "synthetic@example.invalid",
  phone: "11999998888",
  examType: "cnh",
  privacyNoticeVersion: "2026-11-04",
  privacyAcknowledged: true,
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
  turnstileToken: "SIMULACAO-consumed-token",
  website: "",
};
function request(
  body: unknown,
  origin = "https://mugui.example.invalid",
  endpoint = "booking/reconcile",
) {
  return new Request("https://mugui.example.invalid/api/" + endpoint, {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://mugui.example.invalid");
  vi.stubEnv("DATA_HMAC_KEY", "synthetic-hmac-key-at-least-32-characters");
  state.limit = true;
  state.receipt = null;
  state.clauses = [];
  state.query.mockClear();
  state.submitted = 0;
});
afterEach(() => vi.unstubAllEnvs());
describe("Consulta de recebimento sem acesso público a pacientes", () => {
  it("never writes a booking when Siteverify rejects the token", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "synthetic-site-key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "synthetic-private-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ success: false, "error-codes": ["invalid-input-response"] }),
      ),
    );
    try {
      const response = await handleApi(request(payload, undefined, "booking"));
      expect(response.status).toBe(400);
      expect(state.submitted).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("trata falha de transporte do banco como confirmação incerta e não como erro de validação", async () => {
    vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", btoa("01234567890123456789012345678901"));
    vi.stubEnv("TURNSTILE_SECRET_KEY", "synthetic-turnstile-secret-key-at-least-32-characters");
    vi.stubEnv("TURNSTILE_SITE_KEY", "synthetic-site-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ success: true, hostname: "mugui.example.invalid", action: "booking" }),
      ),
    );
    state.bookingError = { code: "", message: "synthetic timeout after possible commit" };
    try {
      expect((await handleApi(request(payload, undefined, "booking"))).status).toBe(503);
    } finally {
      vi.unstubAllGlobals();
      state.bookingError = null;
    }
  });
  it("exige o payload válido, além da chave idempotente", async () => {
    const response = await handleApi(request({ idempotencyKey: payload.idempotencyKey }));
    expect(response.status).toBe(400);
    expect(state.query).not.toHaveBeenCalled();
  });
  it("consulta UUID e fingerprint HMAC e retorna apenas o recibo persistido", async () => {
    state.receipt = { protocol: "SIMULACAO-MG-001", requested_at: "2026-11-04T10:00:00Z" };
    const response = await handleApi(request(payload));
    expect(await response.json()).toEqual({
      state: "confirmed",
      protocol: state.receipt.protocol,
      requestedAt: state.receipt.requested_at,
    });
    expect(state.clauses).toEqual([
      ["idempotency_key", payload.idempotencyKey],
      ["submission_fingerprint", expect.stringMatching(/^[a-f0-9]{64}$/)],
    ]);
  });
  it("não confirma quando não há recibo e aplica origem/rate limit", async () => {
    expect(await (await handleApi(request(payload))).json()).toEqual({ state: "not_found" });
    expect((await handleApi(request(payload, "https://attacker.example.invalid"))).status).toBe(
      403,
    );
    state.limit = false;
    expect((await handleApi(request(payload))).status).toBe(429);
  });
});
