import "@tanstack/react-start/server-only";
import { assertSameOrigin, HttpError } from "@/lib/security";

export function applicationOrigin(request?: Request) {
  let configured: URL;
  try {
    configured = new URL(process.env["APP_ORIGIN"] ?? "");
  } catch {
    throw new HttpError(
      500,
      "Configuração do acesso indisponível. Contate a administração.",
      "BACKEND_CONFIGURATION_ERROR",
    );
  }
  if (
    configured.username ||
    configured.password ||
    configured.search ||
    configured.hash ||
    configured.pathname !== "/" ||
    !["http:", "https:"].includes(configured.protocol) ||
    (process.env["NODE_ENV"] === "production" && configured.protocol !== "https:")
  )
    throw new HttpError(
      500,
      "Configuração do acesso indisponível. Contate a administração.",
      "BACKEND_CONFIGURATION_ERROR",
    );
  if (request && process.env["NODE_ENV"] !== "production") {
    const candidate = new URL(request.url).origin;
    // Populated from the actual Vite listener, never from Host/forwarded headers.
    if (
      (process.env["APP_DEV_ORIGINS"] ?? "")
        .split(",")
        .map((v) => v.trim())
        .includes(candidate)
    )
      return candidate;
  }
  return configured.origin;
}
export function assertApplicationOrigin(request: Request) {
  assertSameOrigin(request, applicationOrigin(request));
}
