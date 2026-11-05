import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { Users } from "@/components/admin/Users";
import { api } from "@/services/api";
const state = vi.hoisted(() => ({ role: "admin", refresh: vi.fn() }));
vi.mock("@/components/admin/AdminShell", () => ({
  useStaff: () => ({ id: "actor", role: state.role }),
}));
vi.mock("@/services/api", () => ({ api: vi.fn() }));
vi.mock("@/components/admin/useData", () => ({
  useData: () => ({
    data: [
      {
        id: "pending",
        full_name: "Pending Staff",
        email: "pending@example.invalid",
        role: "staff",
        active: true,
        can_view_sensitive: false,
        invitation_pending: true,
      },
    ],
    refresh: state.refresh,
  }),
}));
beforeEach(() => {
  state.role = "admin";
  vi.mocked(api).mockReset();
  state.refresh.mockClear();
});
afterEach(cleanup);
function fill() {
  fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "New Staff" } });
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "new@example.invalid" } });
}
it("preserves all staff fields and confirms only the backend result without global loading", async () => {
  let finish: (value: unknown) => void = () => {};
  vi.mocked(api).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<Users />);
  fill();
  const form = screen.getByRole("button", { name: "Enviar convite" }).closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(api).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith(
    "users",
    expect.objectContaining({
      full_name: "New Staff",
      email: "new@example.invalid",
      role: "staff",
      active: true,
      can_view_sensitive: false,
    }),
  );
  expect(screen.getByRole("button", { name: "Enviando convite…" })).toBeDisabled();
  expect(document.querySelector(".mugui-loading")).toBeNull();
  expect(screen.queryByText(/Convite enviado com sucesso/)).not.toBeInTheDocument();
  finish({ invitationSent: true });
  expect(
    await screen.findByText(
      "Convite enviado com sucesso. O funcionário receberá um e-mail para configurar seu acesso à MUGUI.",
    ),
  ).toBeInTheDocument();
});
it("does not claim success on SMTP failure and keeps the draft", async () => {
  vi.mocked(api).mockRejectedValue(new Error("Envio indisponível."));
  render(<Users />);
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Envio indisponível");
  expect(screen.getByLabelText("Nome completo")).toHaveValue("New Staff");
  expect(screen.queryByText(/Convite enviado com sucesso/)).not.toBeInTheDocument();
});
it("distinguishes pending invitations and resends via the invitation endpoint", async () => {
  vi.mocked(api).mockResolvedValue({ invitationSent: true });
  render(<Users />);
  expect(screen.getByText("Convite pendente")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Gerenciar" }));
  fireEvent.click(screen.getByRole("button", { name: "Reenviar convite" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith("users/invitation/resend", { id: "pending" }),
  );
  expect(await screen.findByText(/Convite reenviado/)).toBeInTheDocument();
});
it("does not render invitation actions for staff", () => {
  state.role = "staff";
  render(<Users />);
  expect(screen.getByRole("alert")).toHaveTextContent("restrita");
  expect(screen.queryByRole("button", { name: "Enviar convite" })).not.toBeInTheDocument();
});
