import "@tanstack/react-start/server-only";
import { HttpError } from "@/lib/security";
import { adminClient, authCheck, dbCheck } from "./supabase.server";
import { applicationOrigin } from "./origin.server";

type Invitation = {
  full_name: string;
  email: string;
  role: "admin" | "staff";
  active: boolean;
  can_view_sensitive: boolean;
};
const incomplete = () =>
  new HttpError(
    503,
    "O convite pode ter sido enviado, mas a configuração do acesso não foi concluída. Consulte a listagem e revise as permissões antes de tentar reenviar.",
    "STAFF_INVITATION_INCOMPLETE",
  );
async function audit(actor: string, action: string, id?: string) {
  dbCheck(
    (
      await adminClient()
        .from("audit_logs")
        .insert({
          actor_id: actor,
          action,
          resource_type: "profile",
          ...(id ? { resource_id: id } : {}),
        })
    ).error,
  );
}
export async function sendStaffInvitation(request: Request, actor: string, input: Invitation) {
  const privileged = adminClient();
  // The migration is a prerequisite. Failure here prevents sending an unprotected invitation.
  const existing = await privileged.rpc("find_staff_account", { p_email: input.email });
  if (existing.error)
    throw new HttpError(
      500,
      "Convites aguardando a configuração do banco. Contate a administração.",
      "INVITATIONS_CONFIGURATION_REQUIRED",
    );
  if (existing.data?.length)
    throw new HttpError(
      409,
      "Este e-mail já possui uma conta. Consulte Gerenciar; convites pendentes podem ser reenviados quando elegíveis.",
      "ACCOUNT_CONFLICT",
    );
  await audit(actor, "staff.invitation_requested");
  const result = await privileged.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.full_name, mugui_invitation: true },
    redirectTo: applicationOrigin(request) + "/auth/callback",
  });
  if (result.error) {
    await audit(actor, "staff.invitation_failed");
    authCheck(
      result.error,
      400,
      "Não foi possível enviar o convite. Confira o e-mail e a configuração de envio ou tente mais tarde.",
    );
  }
  const id = result.data.user?.id;
  if (!id) throw incomplete();
  const registered = await privileged.rpc("register_staff_invitation", {
    p_actor: actor,
    p_id: id,
    p_name: input.full_name,
    p_email: input.email,
    p_role: input.role,
    p_active: input.active,
    p_sensitive: input.can_view_sensitive,
  });
  if (registered.error) {
    // Preserve a recoverable, powerless entry even if the Auth trigger was not installed.
    // ignoreDuplicates never overwrites an existing profile or grants requested privileges.
    await privileged.from("profiles").upsert(
      {
        id,
        full_name: input.full_name,
        email: input.email,
        role: "staff",
        active: false,
        can_view_sensitive: false,
        invitation_pending: true,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    await audit(actor, "staff.invitation_configuration_failed", id);
    throw incomplete();
  }
  const ban = await privileged.auth.admin.updateUserById(id, {
    ban_duration: input.active ? "none" : "876000h",
  });
  if (ban.error) throw incomplete();
  return { ok: true, id, invitationSent: true };
}
export async function resendStaffInvitation(
  request: Request,
  actor: string,
  id: string,
  throttle: (email: string) => Promise<void>,
) {
  const privileged = adminClient();
  const profile = await privileged
    .from("profiles")
    .select("id,email,active,invitation_pending")
    .eq("id", id)
    .maybeSingle();
  dbCheck(profile.error);
  if (!profile.data?.active || !profile.data.invitation_pending)
    throw new HttpError(
      409,
      "Reenvio disponível apenas para convites pendentes com acesso autorizado.",
    );
  await throttle(profile.data.email.toLowerCase());
  const account = await privileged.auth.admin.getUserById(id);
  authCheck(account.error, 400, "Não foi possível consultar o convite.");
  if (
    !account.data.user?.invited_at ||
    account.data.user.email_confirmed_at ||
    account.data.user.email?.toLowerCase() !== profile.data.email.toLowerCase()
  )
    throw new HttpError(
      409,
      "O convite já foi aceito ou esta conta não permite reenvio. Use a sessão do convite para concluir a senha; não será enviado um e-mail de recuperação.",
      "INVITATION_RESEND_NOT_ELIGIBLE",
    );
  await audit(actor, "staff.invitation_resend_requested", id);
  const result = await privileged.auth.admin.inviteUserByEmail(profile.data.email, {
    redirectTo: applicationOrigin(request) + "/auth/callback",
  });
  if (result.error) {
    await audit(actor, "staff.invitation_resend_failed", id);
    authCheck(result.error, 400, "Não foi possível reenviar o convite. Aguarde e tente novamente.");
  }
  if (result.data.user?.id !== id) throw incomplete();
  await audit(actor, "staff.invitation_resent", id);
  return { ok: true, invitationSent: true };
}
