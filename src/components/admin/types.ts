import type { StaffProfile } from "@/lib/scheduling";
export type RequestRow = {
  id: string;
  protocol: string;
  exam_type: "cnh" | "clt";
  operational_status:
    "awaiting_review" | "processing" | "scheduled" | "performed" | "completed" | "cancelled";
  laboratory_acceptance_status: "awaiting" | "accepted" | "rejected";
  acceptance_source: "api" | "manual" | null;
  integration_status: "not_configured" | "pending" | "sending" | "sent" | "failed" | "acknowledged";
  assigned_to: string | null;
  requested_at: string;
  status_changed_at: string;
  acceptance_changed_at: string | null;
  updated_at: string;
  scheduled_at: string | null;
  patients: { id: string; full_name: string; document_type: string; document_last4: string };
};
export type Detail = {
  request: RequestRow;
  comments: { id: string; author_id: string; content: string; created_at: string }[];
  history: {
    id: string;
    actor_id: string | null;
    previous_status: string | null;
    new_status: string;
    change_source: string;
    reason: string | null;
    created_at: string;
  }[];
  integration: {
    external_protocol: string | null;
    integration_status: string;
    attempts: number;
    last_attempt_at: string | null;
    next_attempt_at: string | null;
    last_error: string | null;
  };
};
export const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "Não informado";
export type { StaffProfile };
