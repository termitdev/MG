import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { unconfiguredLaboratory, validEvent } from "../_shared/laboratory.ts";

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  if (!unconfiguredLaboratory.configured)
    return Response.json({ error: "laboratory_not_configured" }, { status: 503 });
  if (Number(request.headers.get("Content-Length") ?? 0) > 16384)
    return new Response(null, { status: 413 });
  try {
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 16384) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    // Adapter MUST verify signature, timestamp window and external-to-internal ID mapping before returning an event.
    const event = await unconfiguredLaboratory.verifyAndParseWebhook(
      new TextDecoder().decode(bytes),
      request.headers,
    );
    if (!validEvent(event)) return new Response(null, { status: 400 });
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { error } = await client.rpc("apply_laboratory_event", {
      p_event: event.eventId,
      p_request: event.requestId,
      p_acceptance: event.acceptance ?? null,
      p_operational: event.operationalStatus ?? null,
      p_scheduled_at: event.scheduledAt ?? null,
    });
    if (error) throw new Error("storage_failed");
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "event_not_processed" }, { status: 400 });
  }
});
