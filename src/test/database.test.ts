// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const db = new PGlite();
const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  staff: "10000000-0000-4000-8000-000000000002",
  other: "10000000-0000-4000-8000-000000000003",
  inactive: "10000000-0000-4000-8000-000000000004",
};
let requestId = "";
let otherId = "";
let protocol = "";
async function as(role: string, id: string | null = null, aal = "aal1") {
  await db.exec("reset role;");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: id, aal }),
  ]);
  await db.exec(`set role ${role};`);
}
const submission = (key: string, last4 = "0001") => ({
  full_name: "Paciente Sintético",
  document_type: "rg",
  document_ciphertext: "encrypted-synthetic-document",
  document_key_version: "v1",
  document_fingerprint: "synthetic-hmac-" + last4,
  document_last4: last4,
  birth_date: "1990-01-01",
  email: "synthetic@example.invalid",
  phone: "11999998888",
  exam_type: "cnh",
  privacy_notice_version: "2026-11-04",
  idempotency_key: key,
  submission_fingerprint: "synthetic-submission-hmac",
});
const key = "20000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  await db.exec(
    await readFile(
      new URL("../../supabase/migrations/202611040001_platform.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const [role, id] of Object.entries(ids)) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query(
      "insert into public.profiles(id,full_name,email,role,active) values($1,$2,$3,$4,$5)",
      [
        id,
        "Synthetic " + role,
        role + "@example.invalid",
        role === "admin" ? "admin" : "staff",
        role !== "inactive",
      ],
    );
  }
  await as("service_role");
  const created = await db.query<{ result: { protocol: string } }>(
    "select public.submit_exam_request($1::jsonb) as result",
    [JSON.stringify(submission(key))],
  );
  protocol = created.rows[0]!.result.protocol;
  const rows = await db.query<{ id: string }>("select id from public.exam_requests");
  requestId = rows.rows[0]!.id;
  await db.query("update public.exam_requests set assigned_to=$1 where id=$2", [
    ids.staff,
    requestId,
  ]);
  await db.query("select public.submit_exam_request($1::jsonb)", [
    JSON.stringify(submission("20000000-0000-4000-8000-000000000002", "0002")),
  ]);
  const other = await db.query<{ id: string }>("select id from public.exam_requests where id<>$1", [
    requestId,
  ]);
  otherId = other.rows[0]!.id;
  await db.query("update public.exam_requests set assigned_to=$1 where id=$2", [
    ids.other,
    otherId,
  ]);
}, 30000);
afterAll(async () => {
  await db.close();
});
describe.sequential("PostgreSQL local: migrations, RLS e operações transacionais", () => {
  it("idempotência cria um protocolo, histórico e outbox únicos", async () => {
    await as("service_role");
    const result = await db.query<{ result: { protocol: string } }>(
      "select public.submit_exam_request($1::jsonb) as result",
      [JSON.stringify(submission(key))],
    );
    expect(result.rows[0]!.result.protocol).toBe(protocol);
    const count = await db.query<{ count: number }>(
      "select count(*)::int as count from public.integration_outbox",
    );
    expect(count.rows[0]!.count).toBe(2);
    await expect(
      db.query("select public.submit_exam_request($1::jsonb)", [
        JSON.stringify({ ...submission(key), submission_fingerprint: "different" }),
      ]),
    ).rejects.toThrow("Idempotency conflict");
  });
  it("nega leitura anônima e RPCs privilegiadas", async () => {
    await as("anon");
    for (const table of [
      "patients",
      "exam_requests",
      "profiles",
      "audit_logs",
      "integration_outbox",
    ])
      await expect(db.query(`select * from public.${table}`)).rejects.toThrow(/permission denied/);
    await expect(db.query("select public.submit_exam_request('{}'::jsonb)")).rejects.toThrow(
      /permission denied/,
    );
  });
  it("limita funcionário aos registros atribuídos e mascara documento no banco", async () => {
    await as("authenticated", ids.staff);
    const rows = await db.query<{ id: string }>("select id from public.exam_requests");
    expect(rows.rows.map((r) => r.id)).toEqual([requestId]);
    await expect(db.query("select document_ciphertext from public.patients")).rejects.toThrow(
      /permission denied/,
    );
    expect(
      (await db.query("select id,full_name,document_last4 from public.patients")).rows,
    ).toHaveLength(1);
    await expect(
      db.query("select public.update_request_status($1,'processing','Teste de acesso',null)", [
        otherId,
      ]),
    ).rejects.toThrow("Forbidden");
  });
  it("impede autoelevação, escritas diretas e alterações de aceite por funcionário", async () => {
    await as("authenticated", ids.staff);
    await expect(
      db.query("update public.profiles set role='admin' where id=$1", [ids.staff]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query(
        "update public.exam_requests set laboratory_acceptance_status='accepted' where id=$1",
        [requestId],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select public.record_manual_acceptance($1,'accepted','Confirmação de teste')", [
        requestId,
      ]),
    ).rejects.toThrow("Forbidden");
    await expect(
      db.query("insert into public.audit_logs(action,resource_type) values('x','x')"),
    ).rejects.toThrow(/permission denied/);
  });
  it("bloqueia inativo e exige AAL2 do administrador também na RLS", async () => {
    for (const id of [ids.inactive, ids.admin]) {
      await as("authenticated", id);
      expect((await db.query("select id from public.exam_requests")).rows).toHaveLength(0);
    }
    await as("authenticated", ids.admin, "aal2");
    expect((await db.query("select id from public.exam_requests")).rows).toHaveLength(2);
  });
  it("registra status e comentários sem permitir execução de HTML", async () => {
    await as("authenticated", ids.staff);
    await db.query("select public.update_request_status($1,'processing','Análise iniciada',null)", [
      requestId,
    ]);
    await db.query("select public.add_request_comment($1,$2)", [
      requestId,
      "<script>synthetic()</script>",
    ]);
    expect(
      (await db.query<{ content: string }>("select content from public.patient_comments")).rows[0]!
        .content,
    ).toBe("<script>synthetic()</script>");
    expect(
      (
        await db.query("select id from public.request_status_history where exam_request_id=$1", [
          requestId,
        ])
      ).rows,
    ).toHaveLength(2);
    await expect(
      db.query("select public.update_request_status($1,'scheduled','Sem data',null)", [requestId]),
    ).rejects.toThrow("Invalid transition");
  });
  it("identifica confirmação manual sem alterar integração técnica", async () => {
    await as("authenticated", ids.admin, "aal2");
    await db.query(
      "select public.record_manual_acceptance($1,'accepted','Confirmação manual sintética por canal de teste')",
      [requestId],
    );
    const row = await db.query<{ acceptance_source: string; integration_status: string }>(
      "select acceptance_source,integration_status from public.exam_requests where id=$1",
      [requestId],
    );
    expect(row.rows[0]).toEqual({
      acceptance_source: "manual",
      integration_status: "not_configured",
    });
  });
  it("reivindica uma única lease e separa envio de aceite", async () => {
    await as("service_role");
    expect((await db.query("select * from public.claim_integration_jobs(5)")).rows).toHaveLength(0);
    await db.query(
      "update public.integration_outbox set status='pending' where exam_request_id=$1",
      [otherId],
    );
    const jobs = await db.query<{ id: string; lease_token: string }>(
      "select * from public.claim_integration_jobs(5)",
    );
    expect(jobs.rows).toHaveLength(1);
    expect((await db.query("select * from public.claim_integration_jobs(5)")).rows).toHaveLength(0);
    await db.query("select public.finish_integration_job($1,$2,false,null,'timeout')", [
      jobs.rows[0]!.id,
      jobs.rows[0]!.lease_token,
    ]);
    const state = await db.query<{
      integration_status: string;
      laboratory_acceptance_status: string;
    }>(
      "select integration_status,laboratory_acceptance_status from public.exam_requests where id=$1",
      [otherId],
    );
    expect(state.rows[0]).toEqual({
      integration_status: "failed",
      laboratory_acceptance_status: "awaiting",
    });
  });
  it("deduplica webhooks e registra aceite e recusa reais somente no caminho privilegiado", async () => {
    await as("service_role");
    for (const status of ["accepted", "rejected"]) {
      const result = await db.query<{ result: boolean }>(
        "select public.apply_laboratory_event($1,$2,$3,null,null) as result",
        ["SIMULACAO-" + status, otherId, status],
      );
      expect(result.rows[0]!.result).toBe(true);
      const duplicate = await db.query<{ result: boolean }>(
        "select public.apply_laboratory_event($1,$2,$3,null,null) as result",
        ["SIMULACAO-" + status, otherId, status],
      );
      expect(duplicate.rows[0]!.result).toBe(false);
    }
  });
});
