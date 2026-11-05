import { AppLink } from "@/components/platform/AppLink";
import { useEffect, useState } from "react";
import {
  acceptanceStatuses,
  elapsedSince,
  examTypes,
  integrationStatuses,
  operationalStatuses,
} from "@/lib/scheduling";
import { Action, Field, inputClass, Notice, Status } from "@/components/platform/Controls";
import { useData } from "./useData";
import { dateTime, type RequestRow } from "./types";

export function Requests({
  laboratory = false,
  patients = false,
}: {
  laboratory?: boolean;
  patients?: boolean;
}) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [exam, setExam] = useState("");
  const [acceptance, setAcceptance] = useState("");
  const [integration, setIntegration] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);
  const params = new URLSearchParams({
    q: search,
    status,
    exam,
    acceptance,
    integration,
    from,
    to,
    sort,
    page: String(page),
  });
  const { data, loading, error, refresh } = useData<{
    rows: RequestRow[];
    total: number;
    page: number;
  }>("requests/search", true, Object.fromEntries(params));
  const select = (
    label: string,
    value: string,
    setter: (v: string) => void,
    options: Record<string, string>,
  ) => (
    <label className="min-w-0 text-sm">
      {label}
      <select
        className={`${inputClass} mt-2`}
        value={value}
        onChange={(e) => {
          setter(e.target.value);
          setPage(1);
        }}
      >
        <option value="">Todos</option>
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold">
            {laboratory
              ? "Comunicação com o laboratório"
              : patients
                ? "Pacientes e atendimentos"
                : "Solicitações de exame"}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Dados limitados à sua autorização. Documentos aparecem parcialmente mascarados.
          </p>
        </div>
        <Action secondary onClick={refresh}>
          Atualizar
        </Action>
      </div>
      {laboratory && (
        <Notice>
          A API do laboratório ainda não está configurada. “Enviada” indica transmissão técnica; o
          aceite e o andamento do exame são estados separados.
        </Notice>
      )}
      <div className="admin-filters grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field
          id="search"
          label="Buscar nome ou protocolo"
          value={q}
          maxLength={100}
          onChange={(e) => setQ(e.target.value)}
        />
        {select("Status operacional", status, setStatus, operationalStatuses)}
        {select("Tipo de exame", exam, setExam, examTypes)}
        {select("Aceite do laboratório", acceptance, setAcceptance, acceptanceStatuses)}
        {select("Integração", integration, setIntegration, integrationStatuses)}
        <label className="text-sm">
          Ordenação
          <select
            className={`${inputClass} mt-2`}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
          </select>
        </label>
        <Field
          id="from"
          label="De (data da solicitação)"
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <Field
          id="to"
          label="Até"
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {error ? (
        <Notice error>{error}</Notice>
      ) : loading ? (
        <p role="status">Carregando solicitações…</p>
      ) : !data?.rows.length ? (
        <Notice>Nenhuma solicitação encontrada para estes filtros ou para sua autorização.</Notice>
      ) : (
        <>
          <div className="admin-table hidden overflow-x-auto rounded-3xl border border-border bg-surface md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Solicitações autorizadas</caption>
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  {[
                    "Paciente / protocolo",
                    "Exame / solicitação",
                    "Andamento",
                    "Laboratório / integração",
                    "Responsável / atualização",
                    "",
                  ].map((text, i) => (
                    <th key={i} scope="col" className="whitespace-nowrap p-4 font-medium">
                      {text}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="min-w-48 p-4">
                      <p className="font-medium">{row.patients.full_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.patients.document_type.toUpperCase()} ••••{" "}
                        {row.patients.document_last4}
                      </p>
                      <p className="mt-2 max-w-48 break-all font-mono text-xs">{row.protocol}</p>
                    </td>
                    <td className="min-w-40 p-4">
                      <p>{row.exam_type.toUpperCase()}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dateTime(row.requested_at)}
                      </p>
                      <p className="mt-1 text-xs">Espera: {elapsedSince(row.requested_at)}</p>
                    </td>
                    <td className="p-4">
                      <Status>{operationalStatuses[row.operational_status]}</Status>
                    </td>
                    <td className="min-w-44 space-y-2 p-4">
                      <p>
                        {acceptanceStatuses[row.laboratory_acceptance_status]}
                        {row.acceptance_source === "manual" ? " (registro manual)" : ""}
                      </p>
                      <Status>{integrationStatuses[row.integration_status]}</Status>
                    </td>
                    <td className="min-w-40 p-4 text-xs">
                      <p className="break-all">
                        {row.assigned_to ? `ID ${row.assigned_to.slice(0, 8)}` : "Não atribuído"}
                      </p>
                      <p className="mt-2 text-muted-foreground">{dateTime(row.updated_at)}</p>
                    </td>
                    <td className="p-4">
                      <AppLink
                        href={`/interno/solicitacoes/${row.id}`}
                        className="text-primary underline underline-offset-4"
                      >
                        Visualizar
                      </AppLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-4 md:hidden">
            {data.rows.map((row) => (
              <li
                key={row.id}
                className="space-y-3 rounded-3xl border border-border bg-surface p-5"
              >
                <p className="font-semibold">{row.patients.full_name}</p>
                <p className="break-all font-mono text-xs">{row.protocol}</p>
                <p className="text-sm text-muted-foreground">
                  {row.patients.document_type.toUpperCase()} •••• {row.patients.document_last4} ·{" "}
                  {row.exam_type.toUpperCase()}
                </p>
                <p className="text-xs">
                  {dateTime(row.requested_at)} · {elapsedSince(row.requested_at)}
                </p>
                <Status>{operationalStatuses[row.operational_status]}</Status>
                <p className="text-sm">
                  Laboratório: {acceptanceStatuses[row.laboratory_acceptance_status]}
                  {row.acceptance_source === "manual" ? " (manual)" : ""}
                </p>
                <p className="text-sm">Integração: {integrationStatuses[row.integration_status]}</p>
                <p className="text-xs text-muted-foreground">
                  Responsável: {row.assigned_to?.slice(0, 8) ?? "Não atribuído"} · Atualizado{" "}
                  {dateTime(row.updated_at)}
                </p>
                <AppLink
                  href={`/interno/solicitacoes/${row.id}`}
                  className="inline-block py-2 text-sm text-primary underline"
                >
                  Visualizar detalhes
                </AppLink>
              </li>
            ))}
          </ul>
        </>
      )}
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {data.total} solicitações · Página {page} de {Math.max(1, Math.ceil(data.total / 20))}
          </p>
          <div className="flex gap-2">
            <Action
              secondary
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Action>
            <Action
              secondary
              disabled={page * 20 >= data.total || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Action>
          </div>
        </div>
      )}
    </div>
  );
}
