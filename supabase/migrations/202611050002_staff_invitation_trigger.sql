-- Repairs missing trigger installation without changing any existing account or profile.
begin;
do $$
begin
  if not exists (
    select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
    join pg_namespace n on n.oid=p.pronamespace
    where t.tgrelid='auth.users'::regclass and not t.tgisinternal
      and n.nspname='private' and p.proname='ensure_auth_profile'
  ) then
    create trigger mugui_auth_profile_created after insert on auth.users
      for each row execute function private.ensure_auth_profile();
  end if;
end $$;
commit;
