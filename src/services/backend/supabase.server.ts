import "@tanstack/react-start/server-only";
import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/security";
import type { StaffProfile } from "@/lib/scheduling";
import { inspectAuthConfiguration } from "@/lib/backend-config";
import { applicationOrigin } from "./origin.server";

export function env(name: string) {
  const value = process.env[name];
  if (!value)
    throw new HttpError(
      500,
      "Configuração do acesso indisponível. Contate a administração.",
      "BACKEND_CONFIGURATION_ERROR",
    );
  return value;
}
const options = {
  // The BFF returns a controlled failure; do not retry administrative writes implicitly.
  db: { schema: "public", retry: false },
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(12000) }),
  },
};
export function adminClient() {
  validateAuthConfiguration(true);
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    ...options,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function sessionClient(request: Request, responseHeaders: Headers) {
  validateAuthConfiguration();
  const secure = new URL(applicationOrigin(request)).protocol === "https:";
  const cookies = parseCookieHeader(request.headers.get("cookie") ?? "");
  return createServerClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    ...options,
    cookieOptions: {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => cookies,
      setAll: (items) => {
        for (const { name, value, options: cookieOptions } of items) {
          const index = cookies.findIndex((c) => c.name === name);
          if (index >= 0) cookies[index] = { name, value };
          else cookies.push({ name, value });
          responseHeaders.append(
            "Set-Cookie",
            serializeCookieHeader(name, value, {
              ...cookieOptions,
              httpOnly: true,
              secure,
              sameSite: "lax",
              path: "/",
            }),
          );
        }
      },
    },
  });
}
export type SessionClient = ReturnType<typeof sessionClient>;
function validateAuthConfiguration(administrative = false) {
  const issues = inspectAuthConfiguration(process.env, administrative);
  if (issues.length) {
    console.error("[auth.configuration]", issues);
    throw new HttpError(
      500,
      "Configuração do acesso indisponível. Contate a administração.",
      "BACKEND_CONFIGURATION_ERROR",
    );
  }
}
export function authCheck(
  error:
    | { status?: number | undefined; code?: string | undefined; name?: string | undefined }
    | null
    | undefined,
  invalidStatus = 401,
  message = "Sessão inválida ou expirada. Entre novamente.",
) {
  if (!error) return;
  if (error.status === 429)
    throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos.", "AUTH_RATE_LIMITED");
  if (error.code === "invalid_api_key")
    throw new HttpError(
      500,
      "Configuração do acesso indisponível. Contate a administração.",
      "BACKEND_CONFIGURATION_ERROR",
    );
  if ((error.status ?? 0) >= 500 || error.status === 0 || error.name === "AuthRetryableFetchError")
    throw new HttpError(
      503,
      "Autenticação temporariamente indisponível. Tente novamente.",
      "AUTH_UNAVAILABLE",
    );
  throw new HttpError(
    invalidStatus,
    message,
    invalidStatus === 401
      ? "SESSION_REQUIRED"
      : invalidStatus === 409
        ? "ACCOUNT_CONFLICT"
        : "AUTH_REQUEST_REJECTED",
  );
}
export async function requireStaff(
  client: SessionClient,
  allowMfaSetup = false,
  allowPasswordSetup = false,
) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  authCheck(error);
  if (!user) throw new HttpError(401, "Entre com sua conta de funcionário.", "SESSION_REQUIRED");
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    if (profileError.code === "42501")
      throw new HttpError(403, "Acesso indisponível. Procure a administração.", "ACCESS_DENIED");
    if (["42P01", "PGRST205", "42703"].includes(profileError.code))
      throw new HttpError(
        500,
        "Configuração do acesso indisponível. Contate a administração.",
        "BACKEND_CONFIGURATION_ERROR",
      );
    throw new HttpError(
      503,
      "Não foi possível consultar o acesso agora. Tente novamente.",
      "AUTH_UNAVAILABLE",
    );
  }
  if (!profile?.active || !["staff", "admin"].includes(profile.role))
    throw new HttpError(403, "Acesso indisponível. Procure a administração.", "ACCESS_DENIED");
  if (user.invited_at && typeof profile.invitation_pending !== "boolean")
    throw new HttpError(
      500,
      "Configuração de convites indisponível. Contate a administração.",
      "INVITATIONS_CONFIGURATION_REQUIRED",
    );
  if (profile.invitation_pending && !allowPasswordSetup)
    throw new HttpError(
      403,
      "Conclua a configuração da sua senha para acessar o painel.",
      "PASSWORD_SETUP_REQUIRED",
    );
  const { data: assurance, error: assuranceError } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  authCheck(assuranceError);
  const needsMfa =
    (profile.role === "admin" || assurance?.nextLevel === "aal2") &&
    assurance?.currentLevel !== "aal2";
  if (needsMfa && !allowMfaSetup) throw new HttpError(403, "Verificação multifator necessária.");
  const safeProfile: StaffProfile = {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    role: profile.role,
    active: profile.active,
    can_view_sensitive: profile.can_view_sensitive,
    invitation_pending: profile.invitation_pending === true,
  };
  return { profile: safeProfile, needsMfa, passwordSetup: safeProfile.invitation_pending };
}
export async function requireAdmin(client: SessionClient) {
  const result = await requireStaff(client);
  if (result.profile.role !== "admin")
    throw new HttpError(403, "Operação restrita à administração.");
  return result.profile;
}
export function dbCheck(error: unknown) {
  if (error)
    throw new HttpError(
      400,
      "Não foi possível concluir a operação. Confira os dados e sua permissão.",
    );
}
