import { AppLink } from "@/components/platform/AppLink";
import { useData } from "./useData";
import { Action, Notice } from "@/components/platform/Controls";
import { useStaff } from "./AdminShell";
import {
  ClipboardList,
  Inbox,
  Search,
  Clock3,
  CheckCheck,
  Ban,
  FlaskConical,
  CalendarClock,
  CheckCircle2,
  Unplug,
  Timer,
} from "lucide-react";
const icons = [
  ClipboardList,
  Inbox,
  Search,
  Clock3,
  CheckCheck,
  Ban,
  FlaskConical,
  CalendarClock,
  CheckCircle2,
  Unplug,
];
const labels: Record<string, string> = {
  total: "Total de solicitações",
  new: "Novas nas últimas 24 h",
  awaiting_review: "Aguardando análise",
  awaiting_lab: "Aguardando laboratório",
  accepted: "Aceitas pelo laboratório",
  rejected: "Recusadas",
  processing: "Em processamento",
  scheduled: "Agendadas",
  completed: "Concluídas",
  integration_failed: "Falhas de integração",
};
export function Overview() {
  const { data, error, loading, refresh } = useData<Record<string, number>>("metrics", true);
  const staff = useStaff();
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold">Acompanhamento do atendimento</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {staff.role === "admin"
              ? "Solicitações da unidade."
              : "Indicadores apenas das solicitações atribuídas a você."}{" "}
            Atualização a cada 30 segundos enquanto a aba estiver visível.
          </p>
        </div>
        <Action secondary onClick={refresh}>
          Atualizar
        </Action>
      </div>
      {error ? (
        <Notice error>{error}</Notice>
      ) : loading ? (
        <p role="status">Consultando indicadores…</p>
      ) : (
        data && (
          <>
            <dl className="admin-metrics">
              {Object.entries(labels).map(([key, label], index) => {
                const Icon = icons[index]!;
                return (
                  <div
                    key={key}
                    className={`admin-metric ${key === "total" ? "admin-metric-total" : ""}`}
                  >
                    <dt className="flex items-start justify-between gap-4 text-sm text-muted-foreground">
                      <span>{label}</span>
                      <span className="admin-metric-icon">
                        <Icon className="size-[1.125rem]" aria-hidden />
                      </span>
                    </dt>
                    <dd className="mt-5 text-3xl font-semibold tabular-nums">
                      {typeof data[key] === "number" ? data[key] : "—"}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="admin-wait-note text-sm text-muted-foreground">
              <Timer className="size-5 shrink-0 text-primary" aria-hidden />
              <span>
                Espera média até a resposta do laboratório (ou até agora, se pendente):{" "}
                <strong className="text-foreground">
                  {typeof data["average_wait_minutes"] === "number"
                    ? data["average_wait_minutes"] + " minutos"
                    : "Não disponível"}
                </strong>
                . Este indicador não representa prazo oficial.
              </span>
            </p>
          </>
        )
      )}
      <AppLink
        href="/interno/solicitacoes"
        className="inline-block text-primary underline underline-offset-4"
      >
        Acompanhar solicitações
      </AppLink>
    </div>
  );
}
