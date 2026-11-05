// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import { requireAdmin, requireStaff, type SessionClient } from "@/services/backend/supabase.server";
function client({
  user = true,
  active = true,
  role = "staff",
  current = "aal1",
  next = "aal1",
} = {}) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: user ? { id: "synthetic" } : null },
        error: null,
      })),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () => ({
          data: { currentLevel: current, nextLevel: next },
          error: null,
        })),
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: "synthetic",
              role,
              active,
              full_name: "Synthetic",
              can_view_sensitive: false,
            },
          }),
        }),
      }),
    }),
  } as unknown as SessionClient;
}
describe("Autorização independente do React", () => {
  it("exige usuário validado no provedor", async () => {
    await expect(requireStaff(client({ user: false }))).rejects.toMatchObject({ status: 401 });
  });
  it("nega acesso a usuário desativado", async () => {
    await expect(requireStaff(client({ active: false }))).rejects.toMatchObject({ status: 403 });
  });
  it("exige MFA do administrador e permite apenas configuração antes de AAL2", async () => {
    await expect(requireStaff(client({ role: "admin" }))).rejects.toMatchObject({ status: 403 });
    expect((await requireStaff(client({ role: "admin" }), true)).needsMfa).toBe(true);
    expect(
      (await requireAdmin(client({ role: "admin", current: "aal2", next: "aal2" }))).role,
    ).toBe("admin");
  });
  it("nega operações ADM a funcionário", async () => {
    await expect(requireAdmin(client())).rejects.toMatchObject({ status: 403 });
  });
  it("exige desafio também de funcionário que habilitou MFA", async () => {
    await expect(requireStaff(client({ next: "aal2" }))).rejects.toMatchObject({ status: 403 });
  });
});
