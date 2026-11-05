import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingForm } from "@/components/booking/BookingForm";
import { api } from "@/services/api";
vi.mock("@/services/api", () => ({
  api: vi.fn(),
  ApiError: class extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/components/booking/Turnstile", () => ({
  Turnstile: ({ onToken }: { onToken: (value: string) => void }) => (
    <button type="button" onClick={() => onToken("SIMULACAO-token")}>
      Verificação simulada
    </button>
  ),
}));
const mocked = vi.mocked(api);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
beforeEach(() => {
  mocked.mockImplementation(async (path) =>
    path === "config"
      ? { bookingEnabled: true, turnstileSiteKey: "SIMULACAO" }
      : { protocol: "SIMULACAO-MG-001", requestedAt: "2026-11-04T10:00:00Z" },
  );
});
function field(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
async function completeToReview() {
  field("Nome completo", "Paciente Sintético");
  field("Número do CPF", "52998224725");
  field("Data de nascimento", "1990-01-01");
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  field("E-mail", "synthetic@example.invalid");
  field("Telefone com DDD", "11999998888");
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(screen.getByLabelText("Exame toxicológico para CNH"));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(
    screen.getByLabelText("Li as informações sobre o tratamento dos meus dados pessoais."),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Verificação simulada" }));
}
describe("Formulário em etapas — backend simulado apenas nos testes", () => {
  it("requires consent even after Turnstile succeeds and blocks direct submission without it", async () => {
    render(<BookingForm />);
    await completeToReview();
    const submit = screen.getByRole("button", { name: "Solicitar Agendamento" });
    expect(submit).toBeEnabled();
    fireEvent.click(
      screen.getByLabelText("Li as informações sobre o tratamento dos meus dados pessoais."),
    );
    expect(submit).toBeDisabled();
    fireEvent.submit(screen.getByRole("form", { name: "Agendamento de exame" }));
    expect(mocked.mock.calls.filter(([path]) => path === "booking")).toHaveLength(0);
    fireEvent.click(
      screen.getByLabelText("Li as informações sobre o tratamento dos meus dados pessoais."),
    );
    expect(submit).toBeEnabled();
  });
  it("não apresenta sucesso para uma resposta sem protocolo e data válidos", async () => {
    mocked.mockImplementation(async (path) =>
      path === "config" ? { bookingEnabled: true, turnstileSiteKey: "SIMULACAO" } : {},
    );
    render(<BookingForm />);
    await completeToReview();
    fireEvent.click(screen.getByRole("button", { name: "Solicitar Agendamento" }));
    await screen.findByText(
      "O serviço não retornou um comprovante válido. Vamos verificar o recebimento.",
    );
    expect(screen.queryByText("Solicitação recebida com sucesso!")).not.toBeInTheDocument();
  });
  it("não aciona o loading de envio para campos inválidos", () => {
    render(<BookingForm />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.queryByText("Enviando sua solicitação com segurança…")).not.toBeInTheDocument();
    expect(mocked.mock.calls.filter(([path]) => path === "booking")).toHaveLength(0);
  });
  it("reconcilia timeout pela mesma chave antes de confirmar o recebimento", async () => {
    mocked.mockImplementation(async (path) => {
      if (path === "config") return { bookingEnabled: true, turnstileSiteKey: "SIMULACAO" };
      if (path === "booking") throw new DOMException("Timeout sintético", "TimeoutError");
      return {
        state: "confirmed",
        protocol: "SIMULACAO-RECONCILIADO",
        requestedAt: "2026-11-04T10:00:00Z",
      };
    });
    render(<BookingForm />);
    await completeToReview();
    fireEvent.click(screen.getByRole("button", { name: "Solicitar Agendamento" }));
    expect(await screen.findByText("SIMULACAO-RECONCILIADO")).toBeInTheDocument();
    const sent = mocked.mock.calls.find(([path]) => path === "booking")![1];
    const checked = mocked.mock.calls.find(([path]) => path === "booking/reconcile")![1];
    expect(checked).toEqual(sent);
  });
  it("mantém envio bloqueado e preserva os dados enquanto a confirmação está incerta", async () => {
    let checks = 0;
    mocked.mockImplementation(async (path) => {
      if (path === "config") return { bookingEnabled: true, turnstileSiteKey: "SIMULACAO" };
      if (path === "booking") throw new Error("Conexão interrompida.");
      if (++checks === 1) throw new Error("Consulta indisponível.");
      return {
        state: "confirmed",
        protocol: "SIMULACAO-RECUPERADO",
        requestedAt: "2026-11-04T10:00:00Z",
      };
    });
    render(<BookingForm />);
    await completeToReview();
    fireEvent.click(screen.getByRole("button", { name: "Solicitar Agendamento" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Verificar recebimento" })).toBeEnabled(),
    );
    expect(screen.getByRole("button", { name: "Solicitar Agendamento" })).toBeDisabled();
    expect(screen.getByText("Paciente Sintético")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Verificar recebimento" }));
    expect(await screen.findByText("SIMULACAO-RECUPERADO")).toBeInTheDocument();
    expect(mocked.mock.calls.filter(([path]) => path === "booking")).toHaveLength(1);
  });
  it("valida por etapa e preserva dados ao voltar, inclusive seleção RG", () => {
    render(<BookingForm />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    field("Nome completo", "Paciente Sintético");
    fireEvent.click(screen.getByLabelText("RG"));
    field("Número do RG", "12345678-X");
    field("Data de nascimento", "1990-01-01");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    field("E-mail", "synthetic@example.invalid");
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText("Número do RG")).toHaveValue("12345678-X");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByLabelText("E-mail")).toHaveValue("synthetic@example.invalid");
  });
  it("confirma somente após backend responder e bloqueia envio simultâneo", async () => {
    let resolve: ((value: unknown) => void) | undefined;
    mocked.mockImplementation(async (path) =>
      path === "config"
        ? { bookingEnabled: true, turnstileSiteKey: "SIMULACAO" }
        : new Promise((r) => {
            resolve = r;
          }),
    );
    render(<BookingForm />);
    await completeToReview();
    const form = screen.getByRole("form", { name: "Agendamento de exame" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(mocked.mock.calls.filter(([path]) => path === "booking")).toHaveLength(1);
    expect(screen.queryByText("SIMULACAO-MG-001")).not.toBeInTheDocument();
    expect(screen.getByText("Enviando sua solicitação com segurança…")).toBeInTheDocument();
    expect(document.querySelector(".mugui-loading")).toBeNull();
    resolve?.({ protocol: "SIMULACAO-MG-001", requestedAt: "2026-11-04T10:00:00Z" });
    expect(await screen.findByText("SIMULACAO-MG-001")).toBeInTheDocument();
    expect(screen.getByText(/data e o horário ainda precisam/)).toBeInTheDocument();
  });
  it("exibe falha do backend sem inventar confirmação", async () => {
    mocked.mockImplementation(async (path) => {
      if (path === "config") return { bookingEnabled: true, turnstileSiteKey: "SIMULACAO" };
      throw new Error("Serviço temporariamente indisponível.");
    });
    render(<BookingForm />);
    await completeToReview();
    fireEvent.click(screen.getByRole("button", { name: "Solicitar Agendamento" }));
    expect(await screen.findByText("Serviço temporariamente indisponível.")).toBeInTheDocument();
    expect(screen.queryByText(/recebida com sucesso/)).not.toBeInTheDocument();
  });
});
