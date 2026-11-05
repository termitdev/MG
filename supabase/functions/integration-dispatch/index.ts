import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { dispatchQueue, unconfiguredLaboratory } from "../_shared/laboratory.ts";

Deno.serve(async (request: Request) => {
  const secret = Deno.env.get("INTEGRATION_WORKER_SECRET");
  if (
    request.method !== "POST" ||
    !secret ||
    request.headers.get("Authorization") !== `Bearer ${secret}`
  ) {
    return new Response(null, { status: 401 });
  }
  if (!unconfiguredLaboratory.configured)
    return Response.json({ error: "laboratory_not_configured" }, { status: 503 });
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  try {
    const result = await dispatchQueue(unconfiguredLaboratory, {
      async claim() {
        const { data, error } = await client.rpc("claim_integration_jobs", { p_limit: 5 });
        if (error) throw new Error("storage_failed");
        return data ?? [];
      },
      async finish(job, result) {
        const { error } = await client.rpc("finish_integration_job", {
          p_id: job.id,
          p_lease: job.lease_token,
          p_success: result.success,
          p_external_protocol: result.externalProtocol ?? null,
          p_error: result.error ?? null,
        });
        if (error) throw new Error("storage_failed");
      },
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "integration_temporarily_unavailable" }, { status: 503 });
  }
});
