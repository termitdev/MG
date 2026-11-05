// Internal domain contracts, not the laboratory's undocumented wire protocol.
export type IntegrationReceipt = { externalProtocol: string };
export type LaboratoryEvent = {
  eventId: string;
  requestId: string;
  acceptance?: "accepted" | "rejected";
  operationalStatus?: "processing" | "scheduled" | "performed" | "completed" | "cancelled";
  scheduledAt?: string;
};
export interface LaboratoryAdapter {
  readonly configured: boolean;
  sendRequest(
    requestReference: string,
    idempotencyKey: string,
    signal: AbortSignal,
  ): Promise<IntegrationReceipt>;
  queryProtocol(externalProtocol: string, signal: AbortSignal): Promise<LaboratoryEvent | null>;
  verifyAndParseWebhook(rawBody: string, headers: Headers): Promise<LaboratoryEvent>;
}
export const unconfiguredLaboratory: LaboratoryAdapter = {
  configured: false,
  async sendRequest() {
    throw new Error("not_configured");
  },
  async queryProtocol() {
    throw new Error("not_configured");
  },
  async verifyAndParseWebhook() {
    throw new Error("not_configured");
  },
};
export type OutboxJob = {
  id: string;
  exam_request_id: string;
  idempotency_key: string;
  lease_token: string;
};
export interface IntegrationStore {
  claim(): Promise<OutboxJob[]>;
  finish(
    job: OutboxJob,
    result: { success: boolean; externalProtocol?: string; error?: string },
  ): Promise<void>;
}
export function validEvent(value: LaboratoryEvent) {
  return (
    /^[\w:.-]{1,200}$/.test(value.eventId) &&
    /^[0-9a-f-]{36}$/i.test(value.requestId) &&
    (value.acceptance === undefined || ["accepted", "rejected"].includes(value.acceptance)) &&
    (value.operationalStatus === undefined ||
      ["processing", "scheduled", "performed", "completed", "cancelled"].includes(
        value.operationalStatus,
      )) &&
    (value.acceptance !== undefined || value.operationalStatus !== undefined) &&
    (value.scheduledAt === undefined || Number.isFinite(Date.parse(value.scheduledAt))) &&
    (value.operationalStatus !== "scheduled" || Boolean(value.scheduledAt))
  );
}
export async function dispatchQueue(
  adapter: LaboratoryAdapter,
  store: IntegrationStore,
  timeoutMs = 15000,
) {
  if (!adapter.configured) return { configured: false, processed: 0 };
  const jobs = await store.claim();
  for (const job of jobs) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let outcome: { success: boolean; externalProtocol?: string; error?: string };
    try {
      const receipt = await Promise.race([
        adapter.sendRequest(job.exam_request_id, job.idempotency_key, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("timeout"));
          }, timeoutMs);
        }),
      ]);
      if (
        !receipt ||
        typeof receipt.externalProtocol !== "string" ||
        !/^[\w:./-]{1,200}$/.test(receipt.externalProtocol)
      )
        throw new Error("invalid_response");
      outcome = { success: true, externalProtocol: receipt.externalProtocol };
    } catch (error) {
      outcome = {
        success: false,
        error:
          error instanceof Error && ["timeout", "invalid_response"].includes(error.message)
            ? error.message
            : "communication_failed",
      };
    } finally {
      clearTimeout(timer);
    }
    // Never turn a persistence failure into an immediate resend: the lease must expire first.
    await store.finish(job, outcome);
  }
  return { configured: true, processed: jobs.length };
}
