import "@tanstack/react-start/server-only";
import { z } from "zod";
import { bookingSchema, type BookingInput } from "@/lib/scheduling";
import { HttpError, readJson } from "@/lib/security";
import { applicationOrigin, assertApplicationOrigin } from "./origin.server";
import {
  adminClient,
  authCheck,
  dbCheck,
  requireAdmin,
  requireStaff,
  sessionClient,
} from "./supabase.server";
import { decryptDocument, encryptDocument, fingerprint } from "./crypto.server";
import { turnstileSettings, verifyTurnstile } from "./turnstile.server";
import { sendStaffInvitation, resendStaffInvitation } from "./invitations.server";

const uuid = z.string().uuid();
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
});
const staffSchema = z.object({
  id: uuid.optional(),
  full_name: z.string().trim().min(3).max(150),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  role: z.enum(["admin", "staff"]),
  active: z.boolean(),
  can_view_sensitive: z.boolean(),
});
async function rateLimit(
  request: Request,
  bucket: string,
  limit: number,
  seconds = 600,
  identity = "",
) {
  // Trust only the explicitly configured ingress header. Without it, all callers share a restrictive bucket.
  const ip = process.env["TRUSTED_CLIENT_IP_HEADER"]
    ? (request.headers.get(process.env["TRUSTED_CLIENT_IP_HEADER"]!) ?? "unknown")
    : "shared";
  const key = await fingerprint(`${bucket}:${identity || ip}`);
  const { data, error } = await adminClient().rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_seconds: seconds,
  });
  if (error) {
    if (["PGRST202", "PGRST301", "42501", "42P01"].includes(error.code))
      throw new HttpError(
        500,
        "Configuração do acesso indisponível. Contate a administração.",
        "BACKEND_CONFIGURATION_ERROR",
      );
    throw new HttpError(
      503,
      "Proteção temporariamente indisponível. Tente mais tarde.",
      "PROTECTION_UNAVAILABLE",
    );
  }
  if (!data) throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos.");
}
function parse<T>(schema: z.ZodType<T>, body: unknown) {
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(400, "Dados inválidos. Confira os campos informados.");
  return result.data;
}
const requestFields =
  "id,protocol,exam_type,operational_status,laboratory_acceptance_status,acceptance_source,integration_status,assigned_to,requested_at,status_changed_at,acceptance_changed_at,scheduled_at,updated_at,patients(id,full_name,document_type,document_last4)";

function submissionFingerprint(input: BookingInput) {
  const document = input.documentNumber.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return fingerprint(
    JSON.stringify([
      input.fullName,
      input.documentType,
      document,
      input.birthDate,
      input.email,
      input.phone,
      input.examType,
    ]),
  );
}

export async function handleApi(request: Request): Promise<Response> {
  const headers = new Headers({
    "Cache-Control": "no-store, private",
    Pragma: "no-cache",
    "Content-Type": "application/json; charset=utf-8",
  });
  const respond = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers });
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\//, "");
    if (request.method === "GET" && path === "config") {
      const challenge = turnstileSettings(request);
      return respond({
        bookingEnabled:
          [
            "APP_ORIGIN",
            "SUPABASE_URL",
            "SUPABASE_ANON_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
            "DOCUMENT_ENCRYPTION_KEY",
            "DATA_HMAC_KEY",
          ].every((key) => Boolean(process.env[key])) &&
          Boolean(challenge.siteKey && challenge.secretKey),
        turnstileSiteKey: challenge.siteKey,
      });
    }
    if (request.method === "POST") assertApplicationOrigin(request);
    if (request.method === "POST" && path === "booking/reconcile") {
      await rateLimit(request, "booking-reconcile", 10);
      const input = parse(bookingSchema, await readJson(request));
      // Require both the unguessable per-submission UUID and proof of the original normalized payload.
      // Returns only the receipt, never patient data or laboratory status. No schema/RLS changes.
      const result = await adminClient()
        .from("exam_requests")
        .select("protocol,requested_at")
        .eq("idempotency_key", input.idempotencyKey)
        .eq("submission_fingerprint", await submissionFingerprint(input))
        .maybeSingle();
      if (result.error) throw new HttpError(503, "Não foi possível confirmar o recebimento agora.");
      return respond(
        result.data
          ? {
              state: "confirmed",
              protocol: result.data.protocol,
              requestedAt: result.data.requested_at,
            }
          : { state: "not_found" },
      );
    }
    if (request.method === "POST" && path === "booking") {
      await rateLimit(request, "booking", 5);
      const input = parse(bookingSchema, await readJson(request));
      await verifyTurnstile(request, input.turnstileToken);
      const document = input.documentNumber.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const data = {
        full_name: input.fullName,
        document_type: input.documentType,
        document_ciphertext: await encryptDocument(document),
        document_key_version: "v1",
        document_fingerprint: await fingerprint(input.documentType + ":" + document),
        document_last4: document.slice(-4),
        birth_date: input.birthDate,
        email: input.email,
        phone: input.phone,
        exam_type: input.examType,
        privacy_notice_version: input.privacyNoticeVersion,
        idempotency_key: input.idempotencyKey,
        submission_fingerprint: await submissionFingerprint(input),
      };
      const result = await adminClient().rpc("submit_exam_request", { p_data: data });
      if (result.error) {
        if (result.error.code === "P0001" && result.error.message === "Idempotency conflict")
          throw new HttpError(
            409,
            "Este envio já possui outro conteúdo registrado. Verifique a solicitação com a equipe.",
          );
        // A transport failure can happen after COMMIT; the client must reconcile, not assume rejection.
        throw new HttpError(
          503,
          "Não foi possível confirmar o recebimento agora. Vamos verificar sua solicitação.",
        );
      }
      return respond(result.data, 201);
    }
    const client = sessionClient(request, headers);
    if (request.method === "POST" && path === "auth/login") {
      const input = parse(loginSchema, await readJson(request));
      await rateLimit(request, "login", 10);
      await rateLimit(request, "login-account", 10, 900, input.email.toLowerCase());
      const { error } = await client.auth.signInWithPassword(input);
      authCheck(
        error,
        401,
        "Não foi possível entrar. Confira suas credenciais ou procure a administração.",
      );
      try {
        return respond(await requireStaff(client, true, true));
      } catch (error) {
        if (error instanceof HttpError && error.status === 403)
          await client.auth.signOut({ scope: "local" });
        throw error;
      }
    }
    if (request.method === "POST" && path === "auth/recover") {
      await rateLimit(request, "recovery", 3, 900);
      const input = parse(
        z.object({ email: z.string().email().max(254) }),
        await readJson(request),
      );
      // Do not reveal existence, activity, or provider errors to anonymous callers.
      const delivery = await client.auth.resetPasswordForEmail(input.email, {
        redirectTo: applicationOrigin(request) + "/login?redefinir=1",
      });
      if (
        delivery.error &&
        ((delivery.error.status ?? 0) >= 500 ||
          delivery.error.status === 429 ||
          delivery.error.name === "AuthRetryableFetchError")
      )
        authCheck(delivery.error);
      return respond({ message: "Se houver uma conta elegível, as instruções serão enviadas." });
    }
    if (request.method === "POST" && path === "auth/verify-link") {
      await rateLimit(request, "verify-link", 10);
      const input = parse(
        z.object({ token_hash: z.string().min(20).max(512), type: z.enum(["invite", "recovery"]) }),
        await readJson(request),
      );
      const { error } = await client.auth.verifyOtp(input);
      authCheck(error, 400, "Link inválido ou expirado. Solicite novas instruções.");
      const user = await requireStaff(client, true, true);
      return respond({ ...user, passwordSetup: true });
    }
    if (request.method === "POST" && path === "auth/accept-invite") {
      await rateLimit(request, "accept-invite", 10);
      const input = parse(
        z.object({
          access_token: z.string().min(20).max(16384),
          refresh_token: z.string().min(10).max(2048),
        }),
        await readJson(request),
      );
      const result = await client.auth.setSession(input);
      authCheck(
        result.error,
        400,
        "Convite inválido ou expirado. Solicite um novo convite à administração.",
      );
      try {
        const accepted = await requireStaff(client, true, true);
        if (!accepted.profile.invitation_pending)
          throw new HttpError(409, "Este convite já foi concluído. Entre com seu e-mail e senha.");
        return respond(accepted);
      } catch (error) {
        await client.auth.signOut({ scope: "local" });
        throw error;
      }
    }
    if (request.method === "POST" && path === "auth/logout") {
      const { error } = await client.auth.signOut({ scope: "global" });
      authCheck(error);
      return respond({ ok: true });
    }
    const staff = await requireStaff(client, true, true);
    if (request.method === "GET" && path === "auth/session") return respond(staff);
    if (request.method === "POST" && path === "auth/mfa/enroll") {
      await rateLimit(request, "mfa-enroll", 5, 900, staff.profile.id);
      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "MUGUI " + new Date().toISOString().slice(0, 16),
      });
      dbCheck(error);
      // Avoid SVG injection: UI renders the returned shared secret as plain text.
      return respond({ id: data?.id, secret: data?.totp.secret, uri: data?.totp.uri });
    }
    if (request.method === "GET" && path === "auth/mfa/factors") {
      const { data, error } = await client.auth.mfa.listFactors();
      dbCheck(error);
      return respond(
        data?.totp
          .filter((f) => f.status === "verified")
          .map((f) => ({ id: f.id, name: f.friendly_name })) ?? [],
      );
    }
    if (request.method === "POST" && path === "auth/mfa/verify") {
      await rateLimit(request, "mfa", 8, 600, staff.profile.id);
      const input = parse(
        z.object({ factorId: uuid, code: z.string().regex(/^\d{6}$/) }),
        await readJson(request),
      );
      const { error } = await client.auth.mfa.challengeAndVerify(input);
      dbCheck(error);
      return respond(await requireStaff(client));
    }
    if (request.method === "POST" && path === "auth/password") {
      // An AAL1 administrator must complete MFA before changing their password.
      if (!staff.profile.invitation_pending) await requireStaff(client);
      await rateLimit(request, "password", 5, 900, staff.profile.id);
      const input = parse(
        z.object({ password: z.string().min(12).max(128) }),
        await readJson(request),
      );
      const { error } = await client.auth.updateUser(input);
      // A previous attempt may have saved Auth's password before profile completion failed.
      // The SQL completion still requires a confirmed email and an existing Auth password.
      if (!(staff.profile.invitation_pending && error?.code === "same_password"))
        authCheck(
          error,
          400,
          "Não foi possível salvar a senha. Confira a política de segurança ou tente novamente.",
        );
      if (staff.profile.invitation_pending)
        dbCheck(
          (await adminClient().rpc("complete_staff_invitation", { p_id: staff.profile.id })).error,
        );
      return respond(await requireStaff(client, true, true));
    }
    await requireStaff(client);
    if (request.method === "POST" && path === "requests/search") {
      const filters = parse(
        z.object({
          q: z.string().max(100).default(""),
          page: z
            .string()
            .regex(/^\d{1,5}$/)
            .default("1"),
          status: z.string().max(30).default(""),
          exam: z.string().max(10).default(""),
          acceptance: z.string().max(30).default(""),
          integration: z.string().max(30).default(""),
          from: z.string().max(10).default(""),
          to: z.string().max(10).default(""),
          sort: z.string().max(10).default("newest"),
        }),
        await readJson(request),
      );
      // Search terms remain in POST bodies, never in access-log URLs.
      url.search = new URLSearchParams(filters).toString();
      const page = Math.max(1, Math.min(10000, Number(url.searchParams.get("page")) || 1));
      let query = client.from("exam_requests").select(requestFields, { count: "exact" });
      const search = (url.searchParams.get("q") ?? "")
        .trim()
        .slice(0, 100)
        .replace(/[^\p{L}\p{N}\s-]/gu, "");
      if (search) {
        // Separate RLS-filtered patient query avoids interpolating untrusted SQL/PostgREST expressions.
        const patients = await client
          .from("patients")
          .select("id")
          .ilike("full_name", `%${search}%`)
          .limit(1000);
        dbCheck(patients.error);
        const ids = (patients.data ?? []).map((p) => p.id as string);
        query = query.or(
          `protocol.ilike.%${search}%,patient_id.in.(${ids.length ? ids.join(",") : "00000000-0000-0000-0000-000000000000"})`,
        );
      }
      for (const [param, column] of [
        ["status", "operational_status"],
        ["exam", "exam_type"],
        ["acceptance", "laboratory_acceptance_status"],
        ["integration", "integration_status"],
      ]) {
        const value = url.searchParams.get(param!);
        if (value && /^[a-z_]{1,30}$/.test(value)) query = query.eq(column!, value);
      }
      for (const [param, op] of [
        ["from", "gte"],
        ["to", "lte"],
      ] as const) {
        const value = url.searchParams.get(param);
        if (value && /^\d{4}-\d{2}-\d{2}$/.test(value))
          query = query[op](
            "requested_at",
            value + (op === "gte" ? "T00:00:00-03:00" : "T23:59:59.999-03:00"),
          );
      }
      const sort = url.searchParams.get("sort") === "oldest";
      const result = await query
        .order("requested_at", { ascending: sort })
        .range((page - 1) * 20, page * 20 - 1);
      dbCheck(result.error);
      return respond({ rows: result.data, total: result.count, page });
    }
    if (request.method === "GET" && path === "metrics") {
      const { data, error } = await client.rpc("request_metrics");
      dbCheck(error);
      return respond(data);
    }
    if (path.startsWith("requests/")) {
      const [, rawId, action] = path.split("/");
      const id = parse(uuid, rawId);
      const { data: row, error } = await client
        .from("exam_requests")
        .select(requestFields)
        .eq("id", id)
        .single();
      if (error || !row) throw new HttpError(404, "Solicitação indisponível.");
      if (request.method === "GET" && !action) {
        const [comments, history, integrations] = await Promise.all([
          client
            .from("patient_comments")
            .select("id,author_id,content,created_at")
            .eq("exam_request_id", id)
            .order("created_at"),
          client
            .from("request_status_history")
            .select("id,actor_id,previous_status,new_status,change_source,reason,created_at")
            .eq("exam_request_id", id)
            .order("created_at"),
          client
            .from("laboratory_integrations")
            .select(
              "external_protocol,integration_status,attempts,last_attempt_at,next_attempt_at,last_error",
            )
            .eq("exam_request_id", id)
            .single(),
        ]);
        dbCheck(comments.error);
        dbCheck(history.error);
        dbCheck(integrations.error);
        return respond({
          request: row,
          comments: comments.data,
          history: history.data,
          integration: integrations.data,
        });
      }
      if (request.method === "POST" && action === "sensitive") {
        if (staff.profile.role !== "admin" && !staff.profile.can_view_sensitive)
          throw new HttpError(403, "Sem permissão para dados sensíveis.");
        await rateLimit(request, "sensitive", 60, 600, staff.profile.id);
        const patientId = (row.patients as unknown as { id: string }).id;
        const { data: patient, error: patientError } = await adminClient()
          .from("patients")
          .select("document_ciphertext,document_key_version,birth_date,email,phone")
          .eq("id", patientId)
          .single();
        dbCheck(patientError);
        if (!patient) throw new HttpError(404, "Dados indisponíveis.");
        const audit = await adminClient().from("audit_logs").insert({
          actor_id: staff.profile.id,
          action: "patient.sensitive_viewed",
          resource_type: "exam_request",
          resource_id: id,
        });
        dbCheck(audit.error);
        return respond({
          document: await decryptDocument(
            patient.document_ciphertext,
            patient.document_key_version,
          ),
          birthDate: patient.birth_date,
          email: patient.email,
          phone: patient.phone,
        });
      }
      if (request.method === "POST") {
        await rateLimit(request, "staff-write", 60, 600, staff.profile.id);
        const body = await readJson(request);
        if (action === "status") {
          const input = parse(
            z.object({
              status: z.enum([
                "awaiting_review",
                "processing",
                "scheduled",
                "performed",
                "completed",
                "cancelled",
              ]),
              reason: z.string().trim().min(3).max(1000),
              scheduledAt: z.string().datetime({ offset: true }).nullable(),
            }),
            body,
          );
          dbCheck(
            (
              await client.rpc("update_request_status", {
                p_id: id,
                p_status: input.status,
                p_reason: input.reason,
                p_scheduled_at: input.scheduledAt,
              })
            ).error,
          );
        } else if (action === "comments") {
          const input = parse(z.object({ content: z.string().trim().min(1).max(4000) }), body);
          dbCheck(
            (await client.rpc("add_request_comment", { p_id: id, p_content: input.content })).error,
          );
        } else if (action === "assign") {
          await requireAdmin(client);
          const input = parse(z.object({ assignee: uuid.nullable() }), body);
          dbCheck(
            (await client.rpc("assign_request", { p_id: id, p_assignee: input.assignee })).error,
          );
        } else if (action === "manual-acceptance") {
          await requireAdmin(client);
          const input = parse(
            z.object({
              status: z.enum(["accepted", "rejected"]),
              reason: z.string().trim().min(10).max(1000),
            }),
            body,
          );
          dbCheck(
            (
              await client.rpc("record_manual_acceptance", {
                p_id: id,
                p_status: input.status,
                p_reason: input.reason,
              })
            ).error,
          );
        } else throw new HttpError(404, "Operação indisponível.");
        return respond({ ok: true });
      }
    }
    if (path === "users/password-setup" && request.method === "POST") {
      const actor = await requireAdmin(client);
      await rateLimit(request, "admin-setup-email", 5, 900, actor.id);
      const input = parse(z.object({ id: uuid }), await readJson(request));
      const target = await client.from("profiles").select("*").eq("id", input.id).maybeSingle();
      dbCheck(target.error);
      if (!target.data?.active)
        throw new HttpError(403, "Ative o acesso antes de enviar as instruções.", "ACCESS_DENIED");
      if (target.data.invitation_pending)
        throw new HttpError(
          409,
          "Use o reenvio de convite para esta conta; recuperação de senha não conclui o cadastro inicial.",
        );
      const privileged = adminClient();
      const account = await privileged.auth.admin.getUserById(input.id);
      authCheck(account.error, 400, "Não foi possível consultar a conta.");
      if (account.data.user?.email?.toLowerCase() !== target.data.email.toLowerCase())
        throw new HttpError(
          409,
          "O e-mail do perfil não corresponde à conta. Procure a administração.",
          "ACCOUNT_PROFILE_MISMATCH",
        );
      dbCheck(
        (
          await privileged.from("audit_logs").insert({
            actor_id: actor.id,
            action: "staff.password_setup_requested",
            resource_type: "profile",
            resource_id: input.id,
          })
        ).error,
      );
      const result = await privileged.auth.resetPasswordForEmail(target.data.email, {
        redirectTo: applicationOrigin(request) + "/login?redefinir=1",
      });
      authCheck(
        result.error,
        400,
        "Não foi possível enviar as instruções. Tente novamente mais tarde.",
      );
      return respond({ ok: true });
    }
    if (path === "users/invitation/resend" && request.method === "POST") {
      const actor = await requireAdmin(client);
      const input = parse(z.object({ id: uuid }), await readJson(request));
      await rateLimit(request, "staff-invite", 5, 900, actor.id);
      return respond(
        await resendStaffInvitation(request, actor.id, input.id, (email) =>
          rateLimit(request, "staff-invite-target", 1, 60, email),
        ),
      );
    }
    if (path === "users") {
      const actor = await requireAdmin(client);
      if (request.method === "GET") {
        const result = await client.from("profiles").select("*").order("full_name");
        dbCheck(result.error);
        return respond(result.data);
      }
      if (request.method === "POST") {
        await rateLimit(request, "admin", 20, 900, actor.id);
        const input = parse(staffSchema, await readJson(request));
        if (input.id === actor.id)
          throw new HttpError(403, "Não é permitido alterar o próprio acesso.");
        if (!input.id) {
          await rateLimit(request, "staff-invite", 5, 900, actor.id);
          await rateLimit(request, "staff-invite-target", 1, 60, input.email);
          return respond(await sendStaffInvitation(request, actor.id, input));
        }
        const id = input.id;
        const privileged = adminClient();
        if (id) {
          const account = await privileged.auth.admin.getUserById(id);
          authCheck(account.error, 400, "Não foi possível consultar a conta.");
          if (account.data.user?.email?.toLowerCase() !== input.email)
            throw new HttpError(
              409,
              "Este formulário não altera o e-mail da conta. Utilize o endereço já cadastrado.",
              "ACCOUNT_PROFILE_MISMATCH",
            );
        }
        dbCheck(
          (
            await privileged.rpc("manage_staff_profile", {
              p_actor: actor.id,
              p_id: id,
              p_name: input.full_name,
              p_email: input.email,
              p_role: input.role,
              p_active: input.active,
              p_sensitive: input.can_view_sensitive,
            })
          ).error,
        );
        // RLS and backend check active on every request; the ban additionally blocks refresh/login.
        dbCheck(
          (
            await privileged.auth.admin.updateUserById(id, {
              ban_duration: input.active ? "none" : "876000h",
            })
          ).error,
        );
        return respond({ ok: true, id });
      }
    }
    if (request.method === "GET" && path === "audit") {
      await requireAdmin(client);
      const result = await client
        .from("audit_logs")
        .select("id,actor_id,action,resource_type,resource_id,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      dbCheck(result.error);
      return respond(result.data);
    }
    throw new HttpError(404, "Operação indisponível.");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 503;
    if (status === 429) headers.set("Retry-After", "600");
    // Never log request bodies, provider responses, JWTs, or personal data.
    return respond(
      {
        ...(error instanceof HttpError && error.code ? { code: error.code } : {}),
        error:
          error instanceof HttpError
            ? error.message
            : "Serviço temporariamente indisponível. Tente novamente mais tarde.",
      },
      status,
    );
  }
}
