// Local diagnostic only: prints names/reasons and HTTP status, never keys or provider bodies.
import { loadEnv } from "vite";
import { inspectAuthConfiguration } from "../src/lib/backend-config.ts";
const values = { ...loadEnv("development", process.cwd(), ""), ...process.env };
const issues = inspectAuthConfiguration(values, true);
try {
  const origin = new URL(values.APP_ORIGIN ?? "");
  if (
    origin.origin !== values.APP_ORIGIN ||
    (values.NODE_ENV === "production" && origin.protocol !== "https:")
  )
    throw new Error();
} catch {
  issues.push({ field: "APP_ORIGIN", reason: "Use uma origem exata, HTTPS em produção." });
}
try {
  if (
    !values.DOCUMENT_ENCRYPTION_KEY ||
    Buffer.from(values.DOCUMENT_ENCRYPTION_KEY, "base64").length !== 32
  )
    throw new Error();
} catch {
  issues.push({ field: "DOCUMENT_ENCRYPTION_KEY", reason: "Deve representar 32 bytes em base64." });
}
if ((values.DATA_HMAC_KEY?.length ?? 0) < 32)
  issues.push({
    field: "DATA_HMAC_KEY",
    reason: "Use um segredo independente com ao menos 32 caracteres.",
  });
console.log(JSON.stringify({ configurationValid: issues.length === 0, issues }, null, 2));
if (process.argv.includes("--probe") && issues.length === 0) {
  for (const [name, endpoint, key] of [
    ["Auth público", "/auth/v1/settings", values.SUPABASE_ANON_KEY],
    [
      "API administrativa Auth",
      "/auth/v1/admin/users?page=1&per_page=1",
      values.SUPABASE_SERVICE_ROLE_KEY,
    ],
    ["Tabela profiles", "/rest/v1/profiles?select=id&limit=0", values.SUPABASE_SERVICE_ROLE_KEY],
  ]) {
    try {
      const response = await fetch(new URL(endpoint, values.SUPABASE_URL), {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (name === "Auth público" && response.ok) {
        const settings = await response.json();
        const signupDisabled = settings.disable_signup === true;
        console.log(
          JSON.stringify({ check: name, status: response.status, ok: response.ok, signupDisabled }),
        );
        if (!signupDisabled) process.exitCode = 1;
      } else {
        await response.body?.cancel();
        console.log(JSON.stringify({ check: name, status: response.status, ok: response.ok }));
      }
      if (!response.ok) process.exitCode = 1;
    } catch {
      console.log(JSON.stringify({ check: name, reachable: false }));
      process.exitCode = 1;
    }
  }
}
if (issues.length) process.exitCode = 1;
