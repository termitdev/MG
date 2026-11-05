// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
const db = new PGlite();
const admin = "10000000-0000-4000-8000-000000000001",
  staff = "10000000-0000-4000-8000-000000000002";
async function as(id: string, aal = "aal1") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: id, aal }),
  ]);
  await db.exec("set role authenticated");
}
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',invited_at timestamptz,email_confirmed_at timestamptz,encrypted_password text);
    create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    grant usage on schema auth to authenticated,service_role;
    grant execute on all functions in schema auth to authenticated,service_role;`);
  for (const file of [
    "202611040001_platform.sql",
    "202611040002_auth_profiles.sql",
    "202611050001_staff_invitations.sql",
    "202611050002_staff_invitation_trigger.sql",
  ])
    await db.exec(
      await readFile(new URL("../../supabase/migrations/" + file, import.meta.url), "utf8"),
    );
  await db.query(
    "insert into auth.users(id,email,encrypted_password,email_confirmed_at) values($1,'admin@example.invalid','synthetic-hash',now())",
    [admin],
  );
  await db.query("update public.profiles set role='admin',active=true where id=$1", [admin]);
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data,invited_at) values($1,'staff@example.invalid',$2::jsonb,now())",
    [
      staff,
      JSON.stringify({
        full_name: "Invited Staff",
        mugui_invitation: true,
        role: "admin",
        active: true,
        can_view_sensitive: true,
      }),
    ],
  );
});
afterAll(() => db.close());
it("initializes invitees as pending inactive staff without trusting metadata privileges", async () => {
  const r = await db.query("select * from public.profiles where id=$1", [staff]);
  expect(r.rows[0]).toMatchObject({
    role: "staff",
    active: false,
    can_view_sensitive: false,
    invitation_pending: true,
  });
});
it("registers administrator-authorized fields while keeping the invitation pending", async () => {
  await db.exec("set role service_role");
  await db.query(
    "select public.register_staff_invitation($1,$2,'Invited Staff','staff@example.invalid','staff',true,false)",
    [admin, staff],
  );
  const r = await db.query("select * from public.profiles where id=$1", [staff]);
  expect(r.rows[0]).toMatchObject({
    role: "staff",
    active: true,
    invitation_pending: true,
    can_view_sensitive: false,
  });
  await db.exec("reset role");
});
it("blocks pending accounts in the RLS predicates even if assigned an admin role", async () => {
  await as(staff);
  expect(
    (await db.query<{ allowed: boolean }>("select private.is_active_staff() as allowed")).rows[0]
      ?.allowed,
  ).toBe(false);
  await db.exec("reset role");
  await db.query("update public.profiles set role='admin' where id=$1", [staff]);
  await as(staff, "aal2");
  expect(
    (await db.query<{ allowed: boolean }>("select private.is_admin() as allowed")).rows[0]?.allowed,
  ).toBe(false);
  await db.exec("reset role");
  await db.query("update public.profiles set role='staff' where id=$1", [staff]);
});
it("rejects completion before Auth confirms email and saves the password", async () => {
  await db.exec("set role service_role");
  await expect(db.query("select public.complete_staff_invitation($1)", [staff])).rejects.toThrow(
    "Password setup required",
  );
  await db.exec("reset role");
});
it("cannot escalate privileges or call invitation RPCs with a user token", async () => {
  await as(staff);
  await expect(
    db.query("update public.profiles set invitation_pending=false,role='admin' where id=$1", [
      staff,
    ]),
  ).rejects.toThrow();
  await expect(db.query("select public.complete_staff_invitation($1)", [staff])).rejects.toThrow();
  await expect(
    db.query("select * from public.find_staff_account('admin@example.invalid')"),
  ).rejects.toThrow();
  await db.exec("reset role");
});
it("records completion once and never reactivates an administratively disabled account", async () => {
  await db.query(
    "update auth.users set email_confirmed_at=now(),encrypted_password='synthetic-hash' where id=$1",
    [staff],
  );
  await db.query("update public.profiles set active=false where id=$1", [staff]);
  await db.exec("set role service_role");
  await db.query("select public.complete_staff_invitation($1)", [staff]);
  await db.query("select public.complete_staff_invitation($1)", [staff]);
  expect(
    (await db.query("select * from public.profiles where id=$1", [staff])).rows[0],
  ).toMatchObject({
    active: false,
    invitation_pending: false,
    role: "staff",
    can_view_sensitive: false,
  });
  expect(
    (
      await db.query(
        "select * from public.audit_logs where resource_id=$1 and action='staff.invitation_completed'",
        [staff],
      )
    ).rows,
  ).toHaveLength(1);
  await db.exec("reset role");
  await as(staff);
  expect(
    (await db.query<{ allowed: boolean }>("select private.is_active_staff() as allowed")).rows[0]
      ?.allowed,
  ).toBe(false);
  await db.exec("reset role");
});
it("repairs a missing trigger idempotently without modifying existing profiles", async () => {
  const migration = await readFile(
    new URL("../../supabase/migrations/202611050002_staff_invitation_trigger.sql", import.meta.url),
    "utf8",
  );
  await db.exec("drop trigger mugui_auth_profile_created on auth.users");
  await db.exec(migration);
  await db.exec(migration);
  const created = "10000000-0000-4000-8000-000000000003";
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data,invited_at) values($1,'trigger-test@example.invalid','{\"mugui_invitation\":true}'::jsonb,now())",
    [created],
  );
  expect(
    (await db.query("select * from public.profiles where id=$1", [created])).rows[0],
  ).toMatchObject({
    role: "staff",
    active: false,
    invitation_pending: true,
    can_view_sensitive: false,
  });
  expect(
    (await db.query("select * from public.audit_logs where resource_id=$1", [created])).rows,
  ).toHaveLength(1);
});
