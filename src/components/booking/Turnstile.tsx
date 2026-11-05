import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      size: "compact" | "flexible";
      action: string;
      retry: "never";
      "refresh-expired": "manual";
      "refresh-timeout": "manual";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
      "error-callback": (code: string) => boolean;
    },
  ): string;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
let loadingScript: Promise<TurnstileApi> | undefined;
const selector = "script[data-mugui-turnstile]";
function loadTurnstile() {
  if (loadingScript && document.querySelector(selector)) return loadingScript;
  loadingScript = new Promise<TurnstileApi>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(selector);
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      script?.removeEventListener("load", ready);
      script?.removeEventListener("error", fail);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      script?.remove();
      loadingScript = undefined;
      reject(new Error("script-unavailable"));
    };
    const ready = () => {
      const api = window.turnstile;
      if (!api?.render) {
        fail();
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      resolve(api);
    };
    const timer = setTimeout(fail, 15000);
    // One readiness strategy: the script load event, with no global SDK callback.
    if (!script) {
      script = document.createElement("script");
      script.dataset["muguiTurnstile"] = "true";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      const nonce = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content;
      if (nonce) script.nonce = nonce;
      script.addEventListener("load", ready);
      script.addEventListener("error", fail);
      document.head.append(script);
    } else {
      script.addEventListener("load", ready);
      script.addEventListener("error", fail);
    }
    if (window.turnstile) ready();
  });
  return loadingScript;
}
export function Turnstile({
  siteKey,
  onToken,
  attempt,
}: {
  siteKey: string;
  onToken: (value: string) => void;
  attempt: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const tokenCallback = useRef(onToken);
  const [retry, setRetry] = useState(0);
  const [failure, setFailure] = useState<{ message: string; code?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState<"compact" | "flexible" | null>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => setSize(element.clientWidth >= 300 ? "flexible" : "compact");
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    tokenCallback.current = onToken;
  }, [onToken]);
  useEffect(() => {
    if (!size) return;
    let id: string | undefined,
      api: TurnstileApi | undefined,
      disposed = false;
    let verified = false;
    let failed = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    tokenCallback.current("");
    setLoading(true);
    setFailure(null);
    const fail = (message: string, code?: string) => {
      if (disposed) return;
      failed = true;
      clearTimeout(watchdog);
      tokenCallback.current("");
      setLoading(false);
      setFailure(code ? { message, code } : { message });
    };
    void loadTurnstile()
      .then((loaded) => {
        if (disposed || !container.current) return;
        api = loaded;
        try {
          id = api.render(container.current, {
            sitekey: siteKey,
            size,
            action: "booking",
            retry: "never",
            "refresh-expired": "manual",
            "refresh-timeout": "manual",
            callback: (token) => {
              if (disposed) return;
              verified = true;
              failed = false;
              clearTimeout(watchdog);
              setLoading(false);
              setFailure(null);
              tokenCallback.current(token);
            },
            "expired-callback": () =>
              fail("A verificação expirou. Tente novamente para continuar."),
            "timeout-callback": () =>
              fail("A verificação demorou mais que o esperado. Tente novamente."),
            "error-callback": (code) => {
              const safeCode = /^\d{6}$/.test(String(code)) ? String(code) : undefined;
              const configuration = safeCode && ["110100", "110110", "110200"].includes(safeCode);
              fail(
                configuration
                  ? "A verificação não está disponível neste endereço. Contate a equipe ou tente novamente após a configuração."
                  : "Não foi possível conectar à verificação de segurança. Confira sua conexão e tente novamente.",
                safeCode,
              );
              return true;
            },
          });
          setLoading(false);
          if (!verified && !failed)
            watchdog = setTimeout(
              () =>
                fail(
                  "Não foi possível concluir a verificação. Confira sua conexão e tente novamente.",
                ),
              45000,
            );
        } catch {
          fail("Não foi possível iniciar a verificação de segurança. Tente novamente.");
        }
      })
      .catch(() =>
        fail(
          "Não foi possível carregar a verificação de segurança. Confira sua conexão e tente novamente.",
        ),
      );
    return () => {
      disposed = true;
      clearTimeout(watchdog);
      try {
        if (id !== undefined) api?.remove(id);
      } catch {
        /* A disposed widget must not block navigation. */
      }
      tokenCallback.current("");
    };
  }, [siteKey, attempt, retry, size]);
  return (
    <div className="min-w-0 space-y-3" aria-label="Verificação de segurança">
      <div ref={container} className="min-h-16 w-full min-w-0" />
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando verificação de segurança…
        </p>
      )}
      {failure && (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <p role="alert" className="text-sm text-foreground">
            {failure.message}
            {failure.code && (
              <span className="mt-1 block text-xs text-muted-foreground">
                Código: {failure.code}
              </span>
            )}
          </p>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full border border-border px-4 py-2 text-sm text-primary hover:bg-muted"
            onClick={() => setRetry((value) => value + 1)}
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
