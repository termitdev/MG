import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Requests } from "@/components/admin/Requests";
import { api } from "@/services/api";
vi.mock("@/services/api", () => ({
  api: vi.fn(),
  ApiError: class extends Error {
    status = 400;
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const row = {
  id: "00000000-0000-4000-8000-000000000001",
  protocol: "SIMULACAO-MG-001",
  exam_type: "cnh",
  operational_status: "awaiting_review",
  laboratory_acceptance_status: "awaiting",
  integration_status: "not_configured",
  assigned_to: null,
  requested_at: "2026-11-04T10:00:00Z",
  updated_at: "2026-11-04T10:00:00Z",
  patients: { full_name: "Paciente Sintético", document_type: "rg", document_last4: "0001" },
};
describe("Dashboard com respostas sintéticas isoladas", () => {
  it("lista apenas os campos mascarados e envia busca e filtros ao backend", async () => {
    vi.mocked(api).mockResolvedValue({ rows: [row], total: 1, page: 1 });
    render(<Requests />);
    expect((await screen.findAllByText("Paciente Sintético")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("RG •••• 0001").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Buscar nome ou protocolo"), {
      target: { value: "Sintético" },
    });
    await waitFor(() =>
      expect(
        vi
          .mocked(api)
          .mock.calls.some(
            ([path, body]) =>
              path === "requests/search" && (body as Record<string, string>)["q"] === "Sintético",
          ),
      ).toBe(true),
    );
    fireEvent.change(screen.getByLabelText("Status operacional"), {
      target: { value: "processing" },
    });
    await waitFor(() =>
      expect(
        vi
          .mocked(api)
          .mock.calls.some(
            ([path, body]) =>
              path === "requests/search" &&
              (body as Record<string, string>)["status"] === "processing",
          ),
      ).toBe(true),
    );
  });
  it("apresenta estado vazio e falha sem dados fictícios", async () => {
    vi.mocked(api).mockResolvedValue({ rows: [], total: 0, page: 1 });
    const view = render(<Requests />);
    expect(await screen.findByText(/Nenhuma solicitação encontrada/)).toBeInTheDocument();
    view.unmount();
    vi.mocked(api).mockRejectedValue(new Error("Falha de consulta sintética"));
    render(<Requests />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de consulta sintética");
  });
});
