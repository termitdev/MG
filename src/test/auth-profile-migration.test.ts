// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
const db = new PGlite();
const admin = "10000000-0000-4000-8000-000000000001",
  missing = "10000000-0000-4000-8000-000000000002",
  created = "10000000-0000-4000-8000-000000000003";
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;`);
  await db.exec(
    await readFile(
      new URL("../../supabase/migrations/202611040001_platform.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.query(
    "insert into auth.users(id,email) values($1,'admin@example.invalid'),($2,'missing@example.invalid')",
    [admin, missing],
  );
  await db.query(
    "insert into public.profiles(id,full_name,email,role,active,can_view_sensitive) values($1,'Existing Admin','admin@example.invalid','admin',true,true)",
    [admin],
  );
  await db.exec(
    await readFile(
      new URL("../../supabase/migrations/202611040002_auth_profiles.sql", import.meta.url),
      "utf8",
    ),
  );
});
afterAll(() => db.close());
it("repairs missing profiles as inactive staff while preserving existing admin rights", async () => {
  const rows = await db.query<{
    id: string;
    role: string;
    active: boolean;
    can_view_sensitive: boolean;
  }>("select * from public.profiles order by id");
  expect(rows.rows[0]).toMatchObject({
    id: admin,
    role: "admin",
    active: true,
    can_view_sensitive: true,
  });
  expect(rows.rows[1]).toMatchObject({
    id: missing,
    role: "staff",
    active: false,
    can_view_sensitive: false,
  });
});
it("creates an inactive profile atomically and ignores role/active fields from metadata", async () => {
  await db.query("insert into auth.users values($1,'new@example.invalid',$2::jsonb)", [
    created,
    JSON.stringify({
      full_name: "New Staff",
      role: "admin",
      active: true,
      can_view_sensitive: true,
    }),
  ]);
  const result = await db.query("select * from public.profiles where id=$1", [created]);
  expect(result.rows[0]).toMatchObject({
    full_name: "New Staff",
    role: "staff",
    active: false,
    can_view_sensitive: false,
  });
  const audit = await db.query("select * from public.audit_logs where resource_id=$1", [created]);
  expect(audit.rows).toHaveLength(1);
});
it("does not grant profile writes or trigger execution to authenticated callers", async () => {
  await db.exec("set role authenticated");
  await expect(
    db.query("update public.profiles set role='admin' where id=$1", [created]),
  ).rejects.toThrow();
  await expect(db.exec("select private.ensure_auth_profile()")).rejects.toThrow();
  await db.exec("reset role");
});
