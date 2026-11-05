import "@tanstack/react-start/server-only";
import { HttpError } from "@/lib/security";
import { applicationOrigin } from "./origin.server";

// Public, official Cloudflare testing credentials. Never selected in production.
const testSiteKey = "1x00000000000000000000AA";
const testSecretKey = "1x0000000000000000000000000000000AA";
const dummyToken = "XXXX.DUMMY.TOKEN.XXXX";
const officialTestKey = (value: string) => /^[123]x0+[A-Z]{2}$/.test(value);
const localHostname = (host: string) => {
  if (["localhost", "127.0.0.1", "[::1]"].includes(host)) return true;
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255))
    return false;
  const [a, b] = parts.map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b! >= 16 && b! <= 31);
};
export function turnstileSettings(request: Request) {
  const url = new URL(request.url);
  const localTest =
    process.env["NODE_ENV"] === "development" &&
    localHostname(url.hostname) &&
    applicationOrigin(request) === url.origin &&
    process.env["TURNSTILE_LOCAL_TEST_MODE"] !== "false";
  if (localTest) return { siteKey: testSiteKey, secretKey: testSecretKey, localTest: true };
  const siteKey = process.env["TURNSTILE_SITE_KEY"] ?? "";
  const secretKey = process.env["TURNSTILE_SECRET_KEY"] ?? "";
  if (officialTestKey(siteKey) || officialTestKey(secretKey))
    throw new HttpError(
      500,
      "Verificação de segurança aguardando configuração. Contate a equipe.",
      "TURNSTILE_CONFIGURATION_ERROR",
    );
  return { siteKey, secretKey, localTest: false };
}
export async function verifyTurnstile(request: Request, token: string) {
  const settings = turnstileSettings(request);
  if (!settings.siteKey || !settings.secretKey)
    throw new HttpError(
      500,
      "Verificação de segurança aguardando configuração. Contate a equipe.",
      "TURNSTILE_CONFIGURATION_ERROR",
    );
  if (
    !token ||
    token.length > 2048 ||
    (settings.localTest ? token !== dummyToken : token === dummyToken)
  )
    throw new HttpError(
      400,
      "Verificação de segurança inválida ou expirada. Tente novamente.",
      "TURNSTILE_REJECTED",
    );
  let response: Response;
  let result: { success?: boolean; hostname?: string; action?: string; "error-codes"?: string[] };
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: settings.secretKey, response: token }),
      signal: AbortSignal.timeout(8000),
    });
    result = await response.json();
    if (
      !result ||
      typeof result.success !== "boolean" ||
      (result["error-codes"] !== undefined && !Array.isArray(result["error-codes"]))
    )
      throw new Error("Invalid verification response");
  } catch {
    throw new HttpError(
      503,
      "Não foi possível verificar a segurança agora. Tente novamente.",
      "TURNSTILE_UNAVAILABLE",
    );
  }
  if (!response.ok || result["error-codes"]?.includes("internal-error"))
    throw new HttpError(
      503,
      "Não foi possível verificar a segurança agora. Tente novamente.",
      "TURNSTILE_UNAVAILABLE",
    );
  if (
    result["error-codes"]?.some((code) =>
      ["missing-input-secret", "invalid-input-secret"].includes(code),
    )
  )
    throw new HttpError(
      500,
      "Verificação de segurança aguardando configuração. Contate a equipe.",
      "TURNSTILE_CONFIGURATION_ERROR",
    );
  // Official dummy responses have fixed metadata (observed example.com/no action).
  // Only the isolated local pair uses them, and Siteverify success is still mandatory.
  if (
    result.success !== true ||
    (result["error-codes"]?.length ?? 0) > 0 ||
    (!settings.localTest &&
      (result.hostname !== new URL(applicationOrigin(request)).hostname ||
        result.action !== "booking"))
  )
    throw new HttpError(
      400,
      "Verificação de segurança inválida ou expirada. Tente novamente.",
      "TURNSTILE_REJECTED",
    );
}
