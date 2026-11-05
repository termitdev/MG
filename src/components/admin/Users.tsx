import { useRef, useState } from "react";
import { useStaff } from "./AdminShell";
import { useData } from "./useData";
import { api } from "@/services/api";
import type { StaffProfile } from "./types";
import { Action, Field, inputClass, Notice, Status } from "@/components/platform/Controls";

const blank = {
  id: "",
  full_name: "",
  email: "",
  role: "staff" as "admin" | "staff",
  active: true,
  can_view_sensitive: false,
};
export function Users() {
  const staff = useStaff();
  const { data, error, loading, refresh } = useData<StaffProfile[]>("users");
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  if (staff.role !== "admin") return <Notice error>Área restrita à administração.</Notice>;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold">Acessos da equipe</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Convites exclusivos pela administração. Cada pessoa aceita o convite e define sua própria
          senha. Administradores precisam configurar MFA.
        </p>
      </div>
      {error && <Notice error>{error}</Notice>}
      {loading ? (
        <p role="status">Consultando usuários…</p>
      ) : (
        <ul className="admin-user-list divide-y divide-border">
          {data?.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-5">
              <div className="min-w-0">
                <p className="font-medium">{user.full_name}</p>
                <p className="mt-1 break-all text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-3 flex gap-2">
                  <Status>{user.role === "admin" ? "Administrador" : "Funcionário"}</Status>
                  <Status>
                    {!user.active
                      ? "Inativo"
                      : user.invitation_pending
                        ? "Convite pendente"
                        : "Ativo"}
                  </Status>
                </div>
              </div>
              <Action
                secondary
                disabled={user.id === staff.id}
                onClick={() => {
                  setDraft(user);
                  setMessage("");
                }}
              >
                Gerenciar
              </Action>
            </li>
          ))}
        </ul>
      )}
      <section className="max-w-xl rounded-3xl border border-border bg-surface p-6">
        <h3 className="mb-5 text-xl font-semibold">
          {draft.id ? "Gerenciar acesso" : "Cadastrar funcionário"}
        </h3>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (saving.current) return;
            saving.current = true;
            setBusy(true);
            setActionError("");
            setMessage("");
            void api<{ invitationSent?: boolean }>("users", { ...draft, id: draft.id || undefined })
              .then((result) => {
                if (!draft.id && result.invitationSent !== true)
                  throw new Error(
                    "O envio do convite não foi confirmado. Consulte a listagem antes de tentar novamente.",
                  );
                setMessage(
                  draft.id
                    ? "Permissões atualizadas. A desativação bloqueia imediatamente as operações protegidas."
                    : "Convite enviado com sucesso. O funcionário receberá um e-mail para configurar seu acesso à MUGUI.",
                );
                setDraft(blank);
                refresh();
              })
              .catch((e) => {
                setActionError(e.message);
                refresh();
              })
              .finally(() => {
                saving.current = false;
                setBusy(false);
              });
          }}
        >
          <Field
            id="staff-name"
            label="Nome completo"
            required
            minLength={3}
            maxLength={150}
            value={draft.full_name}
            onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
          />
          <Field
            id="staff-email"
            label="E-mail"
            type="email"
            required
            disabled={Boolean(draft.id)}
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
          <label className="block text-sm">
            Perfil
            <select
              className={`${inputClass} mt-2`}
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value as "staff" | "admin" })}
            >
              <option value="staff">Funcionário</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <label className="flex gap-3 text-sm">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Acesso ativo
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={draft.can_view_sensitive}
              onChange={(e) => setDraft({ ...draft, can_view_sensitive: e.target.checked })}
            />
            Autorizar visualização dos dados pessoais completos nas solicitações atribuídas (acesso
            auditado)
          </label>
          <div className="flex flex-wrap gap-3">
            <Action disabled={busy}>
              {busy
                ? draft.id
                  ? "Salvando…"
                  : "Enviando convite…"
                : draft.id
                  ? "Salvar permissões"
                  : "Enviar convite"}
            </Action>
            {draft.id && (
              <Action type="button" secondary onClick={() => setDraft(blank)}>
                Novo funcionário
              </Action>
            )}
            {draft.id && (
              <Action
                type="button"
                secondary
                disabled={busy || !draft.active}
                onClick={() => {
                  if (saving.current) return;
                  saving.current = true;
                  setBusy(true);
                  setActionError("");
                  setMessage("");
                  const pending = data?.find((user) => user.id === draft.id)?.invitation_pending;
                  void api(pending ? "users/invitation/resend" : "users/password-setup", {
                    id: draft.id,
                  })
                    .then(() =>
                      setMessage(
                        pending
                          ? "Convite reenviado. Verifique o e-mail do funcionário."
                          : "Instruções de recuperação de senha enviadas.",
                      ),
                    )
                    .catch((e) => setActionError(e.message))
                    .finally(() => {
                      saving.current = false;
                      setBusy(false);
                    });
                }}
              >
                {data?.find((user) => user.id === draft.id)?.invitation_pending
                  ? "Reenviar convite"
                  : "Enviar recuperação de senha"}
              </Action>
            )}
          </div>
        </form>
      </section>
      {actionError && <Notice error>{actionError}</Notice>}
      {message && <Notice>{message}</Notice>}
    </div>
  );
}
