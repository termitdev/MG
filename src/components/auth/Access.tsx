import { AppLink } from "@/components/platform/AppLink";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { api, ApiError } from "@/services/api";
import type { StaffProfile } from "@/lib/scheduling";
import { Action, Field, Notice } from "@/components/platform/Controls";
import { Logo } from "@/components/landing/Logo";

type Session = { profile: StaffProfile; needsMfa: boolean; passwordSetup?: boolean };
type Factor = { id: string; name?: string };
export function Access() {
  const router = useRouter({ warn: false });
  const [mode, setMode] = useState<"login" | "recover" | "mfa" | "password">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [factor, setFactor] = useState("");
  const [factors, setFactors] = useState<Factor[]>([]);
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session>();
  const [setupPassword, setSetupPassword] = useState(false);
  const busyRef = useRef(false);
  const initialRequest = useRef<{ promise: Promise<Session>; passwordSetup: boolean } | null>(null);
  useEffect(() => {
    let mounted = true;
    if (!initialRequest.current) {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const tokenHash = fragment.get("token_hash");
      const type = fragment.get("type");
      const params = new URLSearchParams(window.location.search);
      const recovery = params.has("redefinir") || params.has("convite");
      window.history.replaceState(window.history.state, "", window.location.pathname);
      const validLink = Boolean(tokenHash && (type === "invite" || type === "recovery"));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      const implicitInvite = Boolean(accessToken && refreshToken && type === "invite");
      const invalidLink =
        fragment.has("error") ||
        fragment.has("error_code") ||
        (!validLink &&
          !implicitInvite &&
          (fragment.has("access_token") || fragment.has("token_hash") || fragment.has("type")));
      initialRequest.current = {
        promise: invalidLink
          ? Promise.reject(
              new ApiError(
                400,
                "Convite inválido, expirado ou já utilizado. Solicite orientação à administração.",
              ),
            )
          : implicitInvite
            ? api<Session>("auth/accept-invite", {
                access_token: accessToken,
                refresh_token: refreshToken,
              })
            : validLink
              ? api<Session>("auth/verify-link", { token_hash: tokenHash, type })
              : api<Session>("auth/session"),
        passwordSetup: validLink || recovery || implicitInvite,
      };
    }
    busyRef.current = true;
    setBusy(true);
    const pending = initialRequest.current;
    pending.promise
      .then((value) => {
        if (!mounted) return;
        setSession(value);
        setSetupPassword(pending.passwordSetup || value.passwordSetup === true);
        setMode(
          value.profile.invitation_pending ? "password" : value.needsMfa ? "mfa" : "password",
        );
      })
      .catch((e: unknown) => {
        if (mounted && (!(e instanceof ApiError) || e.status !== 401))
          setError(
            e instanceof ApiError
              ? e.message
              : "Não foi possível consultar o acesso. Tente novamente.",
          );
      })
      .finally(() => {
        if (mounted) {
          busyRef.current = false;
          setBusy(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (mode !== "mfa") return;
    api<Factor[]>("auth/mfa/factors")
      .then((value) => {
        setFactors(value);
        setFactor(value[0]?.id ?? "");
      })
      .catch((e) => setError(e.message));
  }, [mode]);
  const run = async (operation: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Operação indisponível. Tente novamente.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const enter = () => {
    if (router) void router.navigate({ to: "/interno" });
    else window.location.assign("/interno");
  };
  const invitation = session?.profile.invitation_pending === true;
  return (
    <main className="platform grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-md">
        <AppLink href="/" aria-label="MUGUI — início" className="inline-flex p-3">
          <Logo />
        </AppLink>
        <div className="mt-10 rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
          <p className="text-sm uppercase tracking-widest text-primary">Equipe MUGUI</p>
          <h1 className="mt-3 text-3xl font-semibold">
            {mode === "recover"
              ? "Recuperar acesso"
              : mode === "mfa"
                ? "Verificação em duas etapas"
                : mode === "password"
                  ? setupPassword
                    ? invitation
                      ? "Bem-vindo à MUGUI"
                      : "Defina sua senha"
                    : "Sua conta"
                  : "Acesso interno"}
          </h1>
          <p className="mb-7 mt-3 text-sm text-muted-foreground">
            {invitation && setupPassword
              ? "Seu convite foi aceito. Defina uma senha para concluir a configuração da sua conta."
              : "Acesso exclusivo para profissionais autorizados."}
          </p>
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (mode === "login") {
                  const value = await api<Session>("auth/login", { email, password });
                  setPassword("");
                  setSession(value);
                  if (value.profile.invitation_pending) {
                    setSetupPassword(true);
                    setMode("password");
                  } else if (value.needsMfa) setMode("mfa");
                  else enter();
                } else if (mode === "recover") {
                  const value = await api<{ message: string }>("auth/recover", { email });
                  setMessage(value.message);
                } else if (mode === "mfa") {
                  const value = await api<Session>("auth/mfa/verify", { factorId: factor, code });
                  setCode("");
                  setSecret("");
                  setSession(value);
                  if (setupPassword) setMode("password");
                  else enter();
                } else if (setupPassword) {
                  if (password.length < 12 || password.length > 128)
                    throw new ApiError(400, "Use uma senha com 12 a 128 caracteres.");
                  if (invitation && password !== confirmPassword)
                    throw new ApiError(400, "As senhas não coincidem.");
                  const value = await api<Session>("auth/password", { password });
                  setPassword("");
                  setConfirmPassword("");
                  setSetupPassword(false);
                  if (invitation) {
                    setSession(value);
                    if (value.needsMfa) setMode("mfa");
                    else enter();
                  } else setMessage("Senha atualizada.");
                }
              });
            }}
          >
            {(mode === "login" || mode === "recover") && (
              <Field
                id="login-email"
                label="E-mail"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
            {(mode === "login" || (mode === "password" && setupPassword)) && (
              <Field
                id="login-password"
                label={setupPassword ? "Nova senha (mínimo de 12 caracteres)" : "Senha"}
                type="password"
                autoComplete={setupPassword ? "new-password" : "current-password"}
                minLength={setupPassword ? 12 : 1}
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            {mode === "password" && setupPassword && invitation && (
              <Field
                id="confirm-password"
                label="Confirmar nova senha"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            )}
            {mode === "mfa" && (
              <>
                {!factor && (
                  <>
                    <Notice>
                      Configure um aplicativo autenticador. Administradores precisam desta
                      verificação para acessar dados e operações.
                    </Notice>
                    <Action
                      type="button"
                      secondary
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const result = await api<{ id: string; secret: string }>(
                            "auth/mfa/enroll",
                            {},
                          );
                          setFactor(result.id);
                          setSecret(result.secret);
                        })
                      }
                    >
                      Configurar autenticador
                    </Action>
                  </>
                )}
                {secret && (
                  <div className="space-y-3 rounded-2xl bg-muted p-4">
                    <p className="text-sm">
                      Adicione uma conta TOTP no seu autenticador usando esta chave. Ela só é
                      exibida nesta configuração.
                    </p>
                    <code className="block break-all select-all text-sm">{secret}</code>
                  </div>
                )}
                {factors.length > 1 && (
                  <select
                    className="w-full rounded-2xl border p-3"
                    aria-label="Autenticador"
                    value={factor}
                    onChange={(e) => setFactor(e.target.value)}
                  >
                    {factors.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name ?? "Autenticador"}
                      </option>
                    ))}
                  </select>
                )}
                {factor && (
                  <Field
                    id="otp"
                    label="Código de 6 dígitos"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                )}
              </>
            )}
            {error && <Notice error>{error}</Notice>}
            {message && <Notice>{message}</Notice>}
            {!(mode === "password" && !setupPassword) && (mode !== "mfa" || factor) && (
              <Action type="submit" className="w-full" disabled={busy}>
                {busy
                  ? "Aguarde…"
                  : mode === "recover"
                    ? "Enviar instruções"
                    : mode === "mfa"
                      ? "Verificar"
                      : mode === "password"
                        ? invitation
                          ? "Concluir cadastro"
                          : "Salvar senha"
                        : "Entrar"}
              </Action>
            )}
            {mode === "password" && !setupPassword && (
              <div className="space-y-4">
                <p className="text-sm">{session?.profile.full_name}</p>
                <Action type="button" className="w-full" onClick={enter}>
                  Ir para o painel
                </Action>
                <Action
                  type="button"
                  secondary
                  className="w-full"
                  onClick={() => {
                    setMode("mfa");
                    setFactor("");
                  }}
                >
                  Configurar ou verificar MFA
                </Action>
                <Action
                  type="button"
                  secondary
                  className="w-full"
                  onClick={() => setSetupPassword(true)}
                >
                  Alterar senha
                </Action>
              </div>
            )}
            {mode === "login" && (
              <button
                type="button"
                disabled={busy}
                className="text-sm text-primary underline underline-offset-4"
                onClick={() => {
                  setMode("recover");
                  setError("");
                }}
              >
                Esqueci minha senha
              </button>
            )}
            {mode === "recover" && (
              <button
                type="button"
                disabled={busy}
                className="text-sm text-primary"
                onClick={() => {
                  setMode("login");
                  setMessage("");
                }}
              >
                Voltar ao login
              </button>
            )}
            {session && (
              <button
                type="button"
                className="block text-sm text-muted-foreground underline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api("auth/logout", {});
                    setSession(undefined);
                    setMode("login");
                    setSecret("");
                  })
                }
              >
                Sair da conta
              </button>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
