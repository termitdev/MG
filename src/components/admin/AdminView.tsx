import { AppLink } from "@/components/platform/AppLink";
import { useLocation } from "@tanstack/react-router";
import { Requests } from "./Requests";
import { RequestDetail } from "./RequestDetail";
import { Users } from "./Users";
import { useStaff } from "./AdminShell";
import { useData } from "./useData";
import { Notice } from "@/components/platform/Controls";
import { dateTime } from "./types";

function Audit() {
  const staff = useStaff();
  return staff.role === "admin" ? (
    <AuditRows />
  ) : (
    <div className="space-y-5">
      <h2 className="text-3xl font-semibold">Histórico dos atendimentos</h2>
      <p className="text-muted-foreground">
        Consulte o histórico de cada solicitação em seus detalhes. A auditoria geral é restrita à
        administração.
      </p>
      <AppLink className="text-primary underline" href="/interno/solicitacoes">
        Consultar minhas solicitações
      </AppLink>
    </div>
  );
}
function AuditRows() {
  const { data, loading, error } = useData<
    {
      id: string;
      actor_id: string | null;
      action: string;
      resource_type: string;
      resource_id: string | null;
      metadata: Record<string, unknown>;
      created_at: string;
    }[]
  >("audit");
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold">Auditoria</h2>
      <p className="text-sm text-muted-foreground">
        Últimos 100 eventos. Sem documentos, credenciais ou payloads clínicos.
      </p>
      {error ? (
        <Notice error>{error}</Notice>
      ) : loading ? (
        <p role="status">Consultando auditoria…</p>
      ) : !data?.length ? (
        <Notice>Nenhum evento registrado.</Notice>
      ) : (
        <ol className="admin-audit divide-y divide-border">
          {data.map((item) => (
            <li key={item.id} className="space-y-2 py-4 text-sm">
              <p className="font-medium">{item.action}</p>
              <p className="text-xs text-muted-foreground">
                {dateTime(item.created_at)} ·{" "}
                {item.actor_id ? `Autor ${item.actor_id.slice(0, 8)}` : "Sistema"}
              </p>
              <p className="break-all font-mono text-xs">
                {item.resource_type} · {item.resource_id}
              </p>
              <p className="break-words text-xs text-muted-foreground">
                {JSON.stringify(item.metadata)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
function Settings() {
  return (
    <div className="max-w-2xl space-y-7">
      <h2 className="text-3xl font-semibold">Configurações e segurança</h2>
      <section className="space-y-3 border-b border-border pb-6">
        <h3 className="text-xl font-semibold">Sua conta</h3>
        <p className="text-sm text-muted-foreground">
          Altere sua senha ou configure o autenticador na área da conta. MFA é obrigatório para
          administradores e recomendado para toda a equipe.
        </p>
        <AppLink href="/login" className="inline-block text-primary underline">
          Gerenciar minha conta
        </AppLink>
      </section>
      <section className="space-y-3 border-b border-border pb-6">
        <h3 className="text-xl font-semibold">Laboratório</h3>
        <Notice>
          Integração ainda não configurada. As solicitações ficam persistidas para análise.
          Credenciais, contratos, assinatura de webhooks e prazos dependem da documentação e
          homologação do laboratório.
        </Notice>
      </section>
      <section className="space-y-3">
        <h3 className="text-xl font-semibold">Retenção e privacidade</h3>
        <p className="text-sm text-muted-foreground">
          Prazos de retenção, responsáveis e SLA dependem de aprovação operacional. O sistema não
          atribui um prazo oficial ao laboratório.
        </p>
        <AppLink href="/privacidade" className="text-primary underline">
          Consultar aviso de privacidade
        </AppLink>
      </section>
    </div>
  );
}
export function AdminView() {
  const path = useLocation({ select: (value) => value.pathname.replace(/^\/interno\//, "") });
  const detail = /^solicitacoes\/([0-9a-f-]{36})$/i.exec(path);
  if (detail?.[1]) return <RequestDetail key={detail[1]} id={detail[1]} />;
  if (path === "pacientes") return <Requests key={path} patients />;
  if (path === "solicitacoes") return <Requests key={path} />;
  if (path === "laboratorio") return <Requests key={path} laboratory />;
  if (path === "usuarios") return <Users />;
  if (path === "historico") return <Audit />;
  if (path === "configuracoes") return <Settings />;
  return <Notice error>Página interna não encontrada.</Notice>;
}
