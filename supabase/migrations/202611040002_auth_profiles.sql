-- Review/apply only with explicit database authorization. No accounts are activated here.
begin;
create or replace function private.ensure_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,full_name,email,role,active,can_view_sensitive)
  values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'full_name'),150),''),'Funcionário'),
    coalesce(new.email,''),'staff',false,false)
  on conflict(id) do nothing;
  insert into public.audit_logs(action,resource_type,resource_id,metadata)
  values('staff.profile_initialized','profile',new.id,'{"source":"auth_trigger","active":false}'::jsonb);
  return new;
end $$;
revoke all on function private.ensure_auth_profile() from public,anon,authenticated;
create trigger mugui_auth_profile_created after insert on auth.users
for each row execute function private.ensure_auth_profile();

-- Repair missing counterparts only, without trusting user_metadata roles or promoting anyone.
with initialized as (
  insert into public.profiles(id,full_name,email,role,active,can_view_sensitive)
  select u.id,coalesce(nullif(left(trim(u.raw_user_meta_data->>'full_name'),150),''),'Funcionário'),
    coalesce(u.email,''),'staff',false,false
  from auth.users u where not exists(select 1 from public.profiles p where p.id=u.id)
  on conflict(id) do nothing returning id
)
insert into public.audit_logs(action,resource_type,resource_id,metadata)
select 'staff.profile_initialized','profile',id,'{"source":"profile_repair","active":false}'::jsonb from initialized;
commit;
