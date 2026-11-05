// Pure validation: no environment reads or secret values in diagnostic results.
export type ConfigurationIssue = { field: string; reason: string };
export function inspectAuthConfiguration(
  values: Record<string, string | undefined>,
  administrative = false,
) {
  const issues: ConfigurationIssue[] = [];
  const add = (field: string, reason: string) => issues.push({ field, reason });
  let url: URL | undefined;
  try {
    url = new URL(values["SUPABASE_URL"] ?? "");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      (url.protocol !== "https:" &&
        !(local && url.protocol === "http:" && values["NODE_ENV"] !== "production"))
    )
      add(
        "SUPABASE_URL",
        "Use a URL HTTPS do projeto (HTTP somente em Supabase local de desenvolvimento).",
      );
  } catch {
    add("SUPABASE_URL", "URL ausente ou inválida.");
  }
  for (const field of administrative
    ? ["SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
    : ["SUPABASE_ANON_KEY"]) {
    const key = values[field];
    const privileged = field === "SUPABASE_SERVICE_ROLE_KEY";
    if (!key) {
      add(field, "Chave ausente.");
      continue;
    }
    if (key.startsWith(privileged ? "sb_secret_" : "sb_publishable_")) continue;
    try {
      const parts = key.split(".");
      if (parts.length !== 3) throw new Error();
      const claims = JSON.parse(atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as {
        role?: string;
        ref?: string;
        exp?: number;
      };
      if (claims.role !== (privileged ? "service_role" : "anon"))
        add(field, "Papel da chave incompatível com este campo.");
      if (
        claims.ref &&
        url?.hostname.endsWith(".supabase.co") &&
        url.hostname !== claims.ref + ".supabase.co"
      )
        add(field, "Chave de outro projeto.");
      if (claims.exp && claims.exp * 1000 <= Date.now()) add(field, "Chave expirada.");
    } catch {
      add(field, "Formato de chave incompatível.");
    }
  }
  return issues;
}
