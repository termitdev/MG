// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  dispatchQueue,
  unconfiguredLaboratory,
  validEvent,
  type IntegrationStore,
  type LaboratoryAdapter,
} from "../../supabase/functions/_shared/laboratory";
const job = {
  id: "job",
  exam_request_id: "request",
  idempotency_key: "persistent-key",
  lease_token: "lease",
};
function setup(sendRequest: LaboratoryAdapter["sendRequest"]) {
  const adapter = { ...unconfiguredLaboratory, configured: true, sendRequest };
  const store: IntegrationStore = {
    claim: vi.fn(async () => [job]),
    finish: vi.fn(async () => undefined),
  };
  return { adapter, store };
}
describe("Simulações isoladas do laboratório — nunca usadas em produção", () => {
  it("não toca a fila se a API não estiver configurada", async () => {
    const { store } = setup(vi.fn());
    expect(await dispatchQueue(unconfiguredLaboratory, store)).toEqual({
      configured: false,
      processed: 0,
    });
    expect(store.claim).not.toHaveBeenCalled();
  });
  it("envia referência com a mesma chave idempotente e não inventa aceite", async () => {
    const send = vi.fn(async () => ({ externalProtocol: "SIMULACAO-001" }));
    const { adapter, store } = setup(send);
    await dispatchQueue(adapter, store);
    expect(send).toHaveBeenCalledWith("request", "persistent-key", expect.any(AbortSignal));
    expect(store.finish).toHaveBeenCalledWith(job, {
      success: true,
      externalProtocol: "SIMULACAO-001",
    });
  });
  it("sanitiza falhas e preserva a solicitação para reenvio", async () => {
    const { adapter, store } = setup(async () => {
      throw new Error("secret-token-and-personal-data");
    });
    await dispatchQueue(adapter, store);
    expect(store.finish).toHaveBeenCalledWith(job, {
      success: false,
      error: "communication_failed",
    });
  });
  it("limita timeout e valida resposta", async () => {
    const timeout = setup(async () => new Promise(() => undefined));
    await dispatchQueue(timeout.adapter, timeout.store, 5);
    expect(timeout.store.finish).toHaveBeenCalledWith(job, { success: false, error: "timeout" });
    const invalid = setup(async () => ({ externalProtocol: "" }));
    await dispatchQueue(invalid.adapter, invalid.store);
    expect(invalid.store.finish).toHaveBeenCalledWith(job, {
      success: false,
      error: "invalid_response",
    });
  });
  it("valida eventos internos de aceite/recusa sem assumir contratos externos", () => {
    const base = {
      eventId: "SIMULACAO-event-1",
      requestId: "00000000-0000-4000-8000-000000000001",
    };
    expect(validEvent({ ...base, acceptance: "accepted" })).toBe(true);
    expect(validEvent({ ...base, acceptance: "rejected" })).toBe(true);
    expect(validEvent({ ...base, operationalStatus: "scheduled" })).toBe(false);
    expect(validEvent(base)).toBe(false);
  });
});
