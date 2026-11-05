import { AppLink } from "@/components/platform/AppLink";
import { useEffect, useState } from "react";
import {
  acceptanceStatuses,
  elapsedSince,
  examTypes,
  integrationStatuses,
  operationalStatuses,
  type OperationalStatus,
} from "@/lib/scheduling";
import { Action, Field, inputClass, Notice, Status } from "@/components/platform/Controls";
import { api } from "@/services/api";
import { useStaff } from "./AdminShell";
import { useData } from "./useData";
import { dateTime, type Detail, type StaffProfile } from "./types";

type Sensitive = { document: string; birthDate: string; email: string; phone: string };
export function RequestDetail({ id }: { id: string }) {
  const { data, error, loading, refresh } = useData<Detail>(`requests/${id}`);
  const staff = useStaff();
  const [sensitive, setSensitive] = useState<Sensitive>();
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<OperationalStatus>("processing");
  const [reason, setReason] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [users, setUsers] = useState<StaffProfile[]>([]);
  const [assignee, setAssignee] = useState("");
  const [manual, setManual] = useState("accepted");
  const [manualReason, setManualReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  useEffect(() => {
    setSensitive(undefined);
    if (staff.role === "admin")
      api<StaffProfile[]>("users")
        .then(setUsers)
        .catch(() => undefined);
  }, [id, staff.role]);
  const mutate = async (action: string, body: unknown) => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    setMessage("");
    try {
      await api(`requests/${id}/${action}`, body);
      setMessage("Operação registrada.");
      setComment("");
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Operação indisponível.");
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <p role="status">Carregando detalhes…</p>;
  if (error) return <Notice error>{error}</Notice>;
  if (!data) return null;
  const row = data.request;
  return (
    <div className="space-y-8">
      <AppLink href="/interno/solicitacoes" className="text-sm text-primary underline">
        Voltar às solicitações
      </AppLink>
      <div>
        <p className="break-all font-mono text-xs text-muted-foreground">{row.protocol}</p>
        <h2 className="mt-3 text-3xl font-semibold">{row.patients.full_name}</h2>
        <p className="mt-2 text-muted-foreground">{examTypes[row.exam_type]}</p>
      </div>
      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="min-w-0 space-y-8">
          <section className="space-y-5 rounded-3xl border border-border bg-surface p-5 sm:p-6">
            <h3 className="text-xl font-semibold">Informações pessoais</h3>
            <p className="text-sm">
              {row.patients.document_type.toUpperCase()} •••• {row.patients.document_last4}
            </p>
            {sensitive ? (
              <>
                <dl className="space-y-3 text-sm">
                  {[
                    ["Documento", sensitive.document],
                    ["Nascimento", sensitive.birthDate.split("-").reverse().join("/")],
                    ["E-mail", sensitive.email],
                    ["Telefone", sensitive.phone],
                  ].map(([label, value]) => (
                    <div key={label} className="grid gap-1 sm:grid-cols-[7rem_1fr]">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="break-all">{value}</dd>
                    </div>
                  ))}
                </dl>
                <Action secondary onClick={() => setSensitive(undefined)}>
                  Ocultar dados
                </Action>
              </>
            ) : staff.role === "admin" || staff.can_view_sensitive ? (
              <Action
                secondary
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setActionError("");
                  void api<Sensitive>(`requests/${id}/sensitive`, {})
                    .then(setSensitive)
                    .catch((e) => setActionError(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                Visualizar dados protegidos (acesso auditado)
              </Action>
            ) : (
              <p className="text-sm text-muted-foreground">
                Informações completas restritas à autorização específica.
              </p>
            )}
          </section>
          <section className="space-y-4">
            <h3 className="text-xl font-semibold">Andamento do exame</h3>
            <div className="flex flex-wrap gap-2">
              <Status>{operationalStatuses[row.operational_status]}</Status>
              <Status>Laboratório: {acceptanceStatuses[row.laboratory_acceptance_status]}</Status>
              <Status>Integração: {integrationStatuses[row.integration_status]}</Status>
            </div>
            {row.acceptance_source === "manual" && (
              <Notice>
                O aceite/recusa foi registrado manualmente pela equipe. Não representa uma
                confirmação recebida pela API.
              </Notice>
            )}
            <dl className="grid gap-5 text-sm sm:grid-cols-2">
              {[
                ["Solicitado em", dateTime(row.requested_at)],
                ["Data do exame", dateTime(row.scheduled_at)],
                ["Desde a solicitação", elapsedSince(row.requested_at)],
                [
                  "Aguardando aceite",
                  row.laboratory_acceptance_status === "awaiting"
                    ? elapsedSince(row.requested_at)
                    : elapsedSince(
                        row.requested_at,
                        new Date(row.acceptance_changed_at ?? row.updated_at).getTime(),
                      ),
                ],
                ["No status atual", elapsedSince(row.status_changed_at)],
                ["Última atualização", dateTime(row.updated_at)],
                ["Protocolo externo", data.integration.external_protocol ?? "Ainda não recebido"],
                [
                  "Responsável interno",
                  users.find((u) => u.id === row.assigned_to)?.full_name ??
                    row.assigned_to ??
                    "Não atribuído",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="space-y-5 border-t border-border pt-7">
            <h3 className="text-xl font-semibold">Comentários internos</h3>
            <p className="text-sm text-muted-foreground">
              Registre somente informações necessárias ao atendimento. Não inclua documentos, senhas
              ou resultados clínicos.
            </p>
            {data.comments.length ? (
              <ul className="space-y-4">
                {data.comments.map((item) => (
                  <li key={item.id} className="rounded-2xl bg-muted p-4">
                    <p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Autor{" "}
                      {users.find((u) => u.id === item.author_id)?.full_name ??
                        item.author_id.slice(0, 8)}{" "}
                      · {dateTime(item.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Ainda não há comentários.</p>
            )}
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void mutate("comments", { content: comment });
              }}
            >
              <label htmlFor="comment" className="block text-sm font-medium">
                Novo comentário
              </label>
              <textarea
                id="comment"
                className={inputClass}
                rows={3}
                required
                maxLength={4000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Action disabled={busy || !comment.trim()}>Adicionar comentário</Action>
            </form>
          </section>
          <section className="space-y-4 border-t border-border pt-7">
            <h3 className="text-xl font-semibold">Histórico do atendimento</h3>
            <ol className="space-y-5 border-l border-border pl-5">
              {data.history.map((item) => (
                <li key={item.id}>
                  <p className="text-sm font-medium">
                    {operationalStatuses[item.new_status as OperationalStatus] ?? item.new_status}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateTime(item.created_at)} · Origem: {item.change_source} ·{" "}
                    {item.actor_id
                      ? `Autor ${users.find((u) => u.id === item.actor_id)?.full_name ?? item.actor_id.slice(0, 8)}`
                      : "Sistema"}
                  </p>
                  {item.reason && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="min-w-0 space-y-7">
          <section className="rounded-3xl border border-border bg-surface p-5">
            <h3 className="text-xl font-semibold">Atualizar andamento</h3>
            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void mutate("status", {
                  status,
                  reason,
                  scheduledAt: scheduledAt
                    ? new Date(scheduledAt + ":00-03:00").toISOString()
                    : null,
                });
              }}
            >
              <label className="block text-sm">
                Status
                <select
                  className={`${inputClass} mt-2`}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OperationalStatus)}
                >
                  {Object.entries(operationalStatuses).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {status === "scheduled" && (
                <Field
                  id="scheduledAt"
                  type="datetime-local"
                  label="Data autorizada (horário de Brasília)"
                  required
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              )}
              <Field
                id="reason"
                label="Justificativa"
                required
                minLength={3}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Action
                disabled={busy || ["completed", "cancelled"].includes(row.operational_status)}
              >
                Registrar mudança
              </Action>
            </form>
          </section>
          {staff.role === "admin" && (
            <>
              <section className="rounded-3xl border border-border p-5">
                <h3 className="text-xl font-semibold">Responsável interno</h3>
                <form
                  className="mt-4 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate("assign", { assignee: assignee || null });
                  }}
                >
                  <select
                    aria-label="Atribuir responsável"
                    className={inputClass}
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                  >
                    <option value="">Sem responsável</option>
                    {users
                      .filter((u) => u.active)
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name}
                        </option>
                      ))}
                  </select>
                  <Action secondary disabled={busy}>
                    Atribuir responsável
                  </Action>
                </form>
              </section>
              <section className="rounded-3xl border border-border p-5">
                <h3 className="text-xl font-semibold">Confirmação manual do laboratório</h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  Use apenas com evidência recebida por um canal autorizado. A origem ficará
                  identificada como manual.
                </p>
                <form
                  className="mt-4 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate("manual-acceptance", { status: manual, reason: manualReason });
                  }}
                >
                  <select
                    aria-label="Aceite manual"
                    className={inputClass}
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                  >
                    <option value="accepted">Aceito por confirmação manual</option>
                    <option value="rejected">Recusado por confirmação manual</option>
                  </select>
                  <Field
                    id="manualReason"
                    label="Canal, evidência e justificativa"
                    minLength={10}
                    maxLength={1000}
                    required
                    value={manualReason}
                    onChange={(e) => setManualReason(e.target.value)}
                  />
                  <Action secondary disabled={busy}>
                    Registrar confirmação manual
                  </Action>
                </form>
              </section>
            </>
          )}
          <section className="space-y-3 border-t border-border pt-6 text-sm">
            <h3 className="text-xl font-semibold">Integração</h3>
            <p>Tentativas: {data.integration.attempts}</p>
            <p>Última tentativa: {dateTime(data.integration.last_attempt_at)}</p>
            <p>Próxima tentativa: {dateTime(data.integration.next_attempt_at)}</p>
            {data.integration.last_error && (
              <Notice error>Código de falha: {data.integration.last_error}</Notice>
            )}
          </section>
        </div>
      </div>
      {actionError && <Notice error>{actionError}</Notice>}
      {message && <Notice>{message}</Notice>}
    </div>
  );
}
