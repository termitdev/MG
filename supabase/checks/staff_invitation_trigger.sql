-- Read-only: run in the Supabase SQL Editor. Returns no account data or secrets.
select t.tgname as trigger_name,
       t.tgenabled in ('O','A') as enabled,
       pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_proc p on p.oid=t.tgfoid
join pg_namespace n on n.oid=p.pronamespace
where t.tgrelid='auth.users'::regclass and not t.tgisinternal
  and n.nspname='private' and p.proname='ensure_auth_profile';
