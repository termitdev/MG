import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Access } from "@/components/auth/Access";
import { api, ApiError } from "@/services/api";
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", async () => ({
  ...(await vi.importActual("@tanstack/react-router")),
  useRouter: () => ({ navigate }),
}));
vi.mock("@/services/api", async () => ({
  ...(await vi.importActual("@/services/api")),
  api: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(api).mockReset();
  navigate.mockReset();
  window.history.replaceState(null, "", "/login");
});
afterEach(() => cleanup());
describe("Access request lifecycle", () => {
  it("accepts the official invitation fragment once, clears it and saves a confirmed password before entering", async () => {
    const pending = {
      profile: {
        id: "synthetic",
        full_name: "Invited",
        role: "staff",
        active: true,
        invitation_pending: true,
      },
      needsMfa: false,
      passwordSetup: true,
    };
    let saved: (value: unknown) => void = () => {};
    window.history.replaceState(
      null,
      "",
      "/auth/callback#access_token=synthetic-provider-access-token&refresh_token=synthetic-provider-refresh-token&type=invite",
    );
    vi.mocked(api)
      .mockResolvedValueOnce(pending)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            saved = resolve;
          }),
      );
    render(
      <StrictMode>
        <Access />
      </StrictMode>,
    );
    expect(await screen.findByRole("heading", { name: "Bem-vindo à MUGUI" })).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/auth/callback");
    expect(
      vi.mocked(api).mock.calls.filter(([path]) => path === "auth/accept-invite"),
    ).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Nova senha (mínimo de 12 caracteres)"), {
      target: { value: "personal-synthetic-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "different-password" },
    });
    const form = screen.getByRole("button", { name: "Concluir cadastro" }).closest("form")!;
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("não coincidem");
    expect(vi.mocked(api).mock.calls.filter(([path]) => path === "auth/password")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "personal-synthetic-password" },
    });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(vi.mocked(api).mock.calls.filter(([path]) => path === "auth/password")).toHaveLength(1);
    expect(navigate).not.toHaveBeenCalled();
    saved({
      ...pending,
      profile: { ...pending.profile, invitation_pending: false },
      passwordSetup: false,
    });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/interno" }));
  });
  it("resumes a pending invitation using the server session and still requires MFA for a new admin", async () => {
    const pending = {
      profile: { id: "synthetic", role: "admin", active: true, invitation_pending: true },
      needsMfa: true,
      passwordSetup: true,
    };
    vi.mocked(api)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce({
        ...pending,
        profile: { ...pending.profile, invitation_pending: false },
        passwordSetup: false,
      })
      .mockResolvedValue([]);
    render(<Access />);
    expect(await screen.findByRole("heading", { name: "Bem-vindo à MUGUI" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nova senha (mínimo de 12 caracteres)"), {
      target: { value: "personal-synthetic-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "personal-synthetic-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Concluir cadastro" }));
    expect(
      await screen.findByRole("heading", { name: "Verificação em duas etapas" }),
    ).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
  it("rejects provider link errors without showing tokens or provider details", async () => {
    window.history.replaceState(
      null,
      "",
      "/auth/callback#error=access_denied&error_description=private-provider-detail&error_code=otp_expired",
    );
    render(<Access />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Convite inválido, expirado ou já utilizado",
    );
    expect(document.body).not.toHaveTextContent("private-provider-detail");
    expect(api).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });
  it("treats no session normally and submits only once while login is pending", async () => {
    let rejectLogin: (error: Error) => void = () => {};
    vi.mocked(api).mockRejectedValueOnce(new ApiError(401, "Entre com sua conta."));
    vi.mocked(api).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectLogin = reject;
        }),
    );
    render(
      <StrictMode>
        <Access />
      </StrictMode>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled());
    expect(api).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "synthetic@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "personal-password" } });
    const form = screen.getByRole("button", { name: "Entrar" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(vi.mocked(api).mock.calls.filter(([path]) => path === "auth/login")).toHaveLength(1);
    rejectLogin(new ApiError(403, "Acesso indisponível. Procure a administração."));
    expect(await screen.findByRole("alert")).toHaveTextContent("Acesso indisponível");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });
  it("shows backend configuration failures instead of silently swallowing the session error", async () => {
    vi.mocked(api).mockRejectedValue(
      new ApiError(500, "Configuração do acesso indisponível. Contate a administração."),
    );
    render(<Access />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Configuração do acesso indisponível",
    );
    expect(api).toHaveBeenCalledTimes(1);
  });
  it("consumes the one-time recovery link once even in StrictMode and allows a personal password", async () => {
    window.history.replaceState(
      null,
      "",
      "/login#token_hash=synthetic-one-time-hash-token&type=recovery",
    );
    vi.mocked(api).mockResolvedValue({
      profile: { id: "synthetic", full_name: "Synthetic", role: "staff", active: true },
      needsMfa: false,
    });
    render(
      <StrictMode>
        <Access />
      </StrictMode>,
    );
    const input = await screen.findByLabelText("Nova senha (mínimo de 12 caracteres)");
    expect(vi.mocked(api).mock.calls.filter(([path]) => path === "auth/verify-link")).toHaveLength(
      1,
    );
    expect(window.location.hash).toBe("");
    fireEvent.change(input, { target: { value: "a-personal-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvar senha" }).closest("form")!);
    expect(await screen.findByText("Senha atualizada.")).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("auth/password", { password: "a-personal-password" });
  });
});
