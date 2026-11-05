-- Review and apply only with explicit authorization. Does not invite or activate accounts.
begin;
alter table public.profiles add column invitation_pending boolean not null default false;

create or replace function private.ensure_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,full_name,email,role,active,can_view_sensitive,invitation_pending)
  values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'full_name'),150),''),'Funcionário'),
    coalesce(new.email,''),'staff',false,false,
    coalesce(new.raw_user_meta_data->>'mugui_invitation','false')='true')
  on conflict(id) do nothing;
  insert into public.audit_logs(action,resource_type,resource_id,metadata)
  values('staff.profile_initialized','profile',new.id,'{"source":"auth_trigger","active":false}'::jsonb);
  return new;
end $$;

-- Only genuinely invited accounts without a password are pending; preserve all access flags.
update public.profiles p set invitation_pending=true
from auth.users u where u.id=p.id and u.invited_at is not null
  and coalesce(u.encrypted_password,'')='';

create or replace function private.is_active_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and active
    and not invitation_pending and (role<>'admin' or (select auth.jwt()->>'aal')='aal2'));
$$;
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and active
    and not invitation_pending and role='admin' and (select auth.jwt()->>'aal')='aal2');
$$;

create function public.find_staff_account(p_email text)
returns table(id uuid,invited_at timestamptz,email_confirmed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.id,u.invited_at,u.email_confirmed_at from auth.users u
  where lower(u.email)=lower(trim(p_email));
$$;

create function public.register_staff_invitation(p_actor uuid,p_id uuid,p_name text,p_email text,p_role text,p_active boolean,p_sensitive boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_actor=p_id or not exists(select 1 from public.profiles where id=p_actor
    and active and not invitation_pending and role='admin') then raise exception 'Forbidden'; end if;
  if p_role not in ('admin','staff') or not exists(select 1 from auth.users where id=p_id
    and lower(email)=lower(p_email) and invited_at is not null
    and coalesce(encrypted_password,'')='') then raise exception 'Invalid invitation'; end if;
  insert into public.profiles(id,full_name,email,role,active,can_view_sensitive,invitation_pending)
  values(p_id,p_name,p_email,p_role,p_active,p_sensitive,true)
  on conflict(id) do update set full_name=excluded.full_name,email=excluded.email,
    role=excluded.role,active=excluded.active,can_view_sensitive=excluded.can_view_sensitive,
    invitation_pending=true,updated_at=now();
  insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
  values(p_actor,'staff.invitation_sent','profile',p_id,
    jsonb_build_object('role',p_role,'active',p_active,'sensitive',p_sensitive));
end $$;

create function public.complete_staff_invitation(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from auth.users where id=p_id and email_confirmed_at is not null
    and coalesce(encrypted_password,'')<>'') then raise exception 'Password setup required'; end if;
  update public.profiles set invitation_pending=false,updated_at=now()
  where id=p_id and invitation_pending;
  if found then
    insert into public.audit_logs(actor_id,action,resource_type,resource_id)
    values(p_id,'staff.invitation_completed','profile',p_id);
  end if;
  -- Never change active, role or can_view_sensitive here.
end $$;

revoke all on function public.find_staff_account(text),public.register_staff_invitation(uuid,uuid,text,text,text,boolean,boolean),public.complete_staff_invitation(uuid) from public,anon,authenticated;
grant execute on function public.find_staff_account(text),public.register_staff_invitation(uuid,uuid,text,text,text,boolean,boolean),public.complete_staff_invitation(uuid) to service_role;
revoke all on function private.ensure_auth_profile() from public,anon,authenticated;
commit;
