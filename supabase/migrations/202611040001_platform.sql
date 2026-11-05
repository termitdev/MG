begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (length(full_name) between 1 and 150),
  email text not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  active boolean not null default false,
  can_view_sensitive boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.patients (
  id uuid primary key default gen_random_uuid(), full_name text not null,
  document_type text not null check (document_type in ('cpf','rg')),
  document_ciphertext text not null, document_key_version text not null,
  document_fingerprint text not null, document_last4 text not null check (length(document_last4) = 4),
  birth_date date not null check (birth_date >= '1900-01-01'), email text not null, phone text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.exam_requests (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique default ('MG-' || upper(replace(gen_random_uuid()::text,'-',''))),
  patient_id uuid not null references public.patients(id),
  exam_type text not null check (exam_type in ('cnh','clt')),
  operational_status text not null default 'awaiting_review' check (operational_status in ('awaiting_review','processing','scheduled','performed','completed','cancelled')),
  laboratory_acceptance_status text not null default 'awaiting' check (laboratory_acceptance_status in ('awaiting','accepted','rejected')),
  acceptance_source text check (acceptance_source in ('api','manual')),
  integration_status text not null default 'not_configured' check (integration_status in ('not_configured','pending','sending','sent','failed','acknowledged')),
  assigned_to uuid references public.profiles(id),
  requested_at timestamptz not null default now(), status_changed_at timestamptz not null default now(),
  acceptance_changed_at timestamptz, scheduled_at timestamptz, updated_at timestamptz not null default now(),
  privacy_notice_version text not null, privacy_acknowledged_at timestamptz not null default now(),
  idempotency_key uuid not null unique, submission_fingerprint text not null,
  check (operational_status <> 'scheduled' or scheduled_at is not null)
);
create index exam_requests_queue_idx on public.exam_requests (assigned_to, requested_at desc);
create index exam_requests_status_idx on public.exam_requests (operational_status, exam_type, requested_at desc);
create index exam_requests_patient_idx on public.exam_requests (patient_id);
create table public.patient_comments (
  id uuid primary key default gen_random_uuid(), exam_request_id uuid not null references public.exam_requests(id),
  author_id uuid not null references public.profiles(id), content text not null check (length(content) between 1 and 4000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.request_status_history (
  id uuid primary key default gen_random_uuid(), exam_request_id uuid not null references public.exam_requests(id),
  previous_status text, new_status text not null, actor_id uuid references public.profiles(id),
  change_source text not null check (change_source in ('public','staff','api','manual')),
  reason text check (length(reason) <= 1000), created_at timestamptz not null default now()
);
create table public.laboratory_integrations (
  id uuid primary key default gen_random_uuid(), exam_request_id uuid not null unique references public.exam_requests(id),
  external_protocol text, integration_status text not null default 'not_configured' check (integration_status in ('not_configured','pending','sending','sent','failed','acknowledged')),
  attempts integer not null default 0, last_attempt_at timestamptz, next_attempt_at timestamptz, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.integration_outbox (
  id uuid primary key default gen_random_uuid(), exam_request_id uuid not null references public.exam_requests(id),
  event_type text not null default 'exam_request.created', idempotency_key uuid not null unique,
  payload_reference uuid not null references public.exam_requests(id),
  status text not null default 'not_configured' check (status in ('not_configured','pending','sending','sent','failed','acknowledged')),
  attempts integer not null default 0, last_attempt_at timestamptz, next_attempt_at timestamptz,
  locked_until timestamptz, lease_token uuid, last_error text, processed_at timestamptz, created_at timestamptz not null default now()
);
create index outbox_pending_idx on public.integration_outbox (next_attempt_at) where status in ('pending','failed','sending');
create table public.laboratory_events (
  id uuid primary key default gen_random_uuid(), external_event_id text not null unique,
  exam_request_id uuid not null references public.exam_requests(id), event_type text not null,
  received_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id),
  action text not null, resource_type text not null, resource_id uuid,
  metadata jsonb not null default '{}'::jsonb check (octet_length(metadata::text) <= 2048),
  created_at timestamptz not null default now()
);
create table private.rate_limits (key text primary key, count integer not null, expires_at timestamptz not null);
create index comments_request_idx on public.patient_comments (exam_request_id, created_at);
create index history_request_idx on public.request_status_history (exam_request_id, created_at);
create index audit_created_idx on public.audit_logs (created_at desc);

create function private.is_active_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and active
    and (role <> 'admin' or (select auth.jwt()->>'aal') = 'aal2'));
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and active and role = 'admin'
    and (select auth.jwt()->>'aal') = 'aal2');
$$;
create function private.can_view_request(request_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_staff() and exists(select 1 from public.exam_requests where id = request_id
    and (assigned_to = (select auth.uid()) or private.is_admin()));
$$;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.exam_requests enable row level security;
alter table public.patient_comments enable row level security;
alter table public.request_status_history enable row level security;
alter table public.laboratory_integrations enable row level security;
alter table public.integration_outbox enable row level security;
alter table public.laboratory_events enable row level security;
alter table public.audit_logs enable row level security;
alter table private.rate_limits enable row level security;
revoke all on public.profiles, public.patients, public.exam_requests, public.patient_comments,
 public.request_status_history, public.laboratory_integrations, public.integration_outbox, public.laboratory_events, public.audit_logs from anon, authenticated;
grant select on public.profiles, public.exam_requests, public.patient_comments, public.request_status_history, public.laboratory_integrations, public.audit_logs to authenticated;
grant select (id, full_name, document_type, document_last4) on public.patients to authenticated;
grant all on public.profiles, public.patients, public.exam_requests, public.patient_comments, public.request_status_history,
 public.laboratory_integrations, public.integration_outbox, public.laboratory_events, public.audit_logs to service_role;
create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or private.is_admin());
create policy requests_read on public.exam_requests for select to authenticated using (private.can_view_request(id));
create policy patients_read on public.patients for select to authenticated using (exists(
 select 1 from public.exam_requests where patient_id = patients.id and private.can_view_request(id)));
create policy comments_read on public.patient_comments for select to authenticated using (deleted_at is null and private.can_view_request(exam_request_id));
create policy history_read on public.request_status_history for select to authenticated using (private.can_view_request(exam_request_id));
create policy integrations_read on public.laboratory_integrations for select to authenticated using (private.can_view_request(exam_request_id));
create policy audit_read on public.audit_logs for select to authenticated using (private.is_admin());
-- INSERT/UPDATE/DELETE: no policies or grants for anon/authenticated. Writes use restricted RPCs.
-- Outbox and webhook receipts have no client policies and are backend-only.

create function public.consume_rate_limit(p_key text, p_limit integer, p_seconds integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare hits integer;
begin
  if p_limit < 1 or p_seconds < 1 then raise exception 'Invalid limit'; end if;
  insert into private.rate_limits as r values(p_key,1,now()+make_interval(secs=>p_seconds))
  on conflict(key) do update set count = case when r.expires_at <= now() then 1 else r.count+1 end,
    expires_at = case when r.expires_at <= now() then now()+make_interval(secs=>p_seconds) else r.expires_at end
  returning count into hits;
  return hits <= p_limit;
end $$;

create function public.submit_exam_request(p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare patient uuid; request public.exam_requests; existing public.exam_requests;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_data->>'idempotency_key',0));
  select * into existing from public.exam_requests where idempotency_key = (p_data->>'idempotency_key')::uuid;
  if found then
    if existing.submission_fingerprint <> p_data->>'submission_fingerprint' then raise exception 'Idempotency conflict'; end if;
    return jsonb_build_object('protocol',existing.protocol,'requestedAt',existing.requested_at);
  end if;
  if length(p_data->>'full_name') not between 5 and 150 or (p_data->>'birth_date')::date > current_date
     or p_data->>'exam_type' not in ('cnh','clt') or p_data->>'privacy_notice_version' <> '2026-11-04'
     or length(p_data->>'document_ciphertext') > 512 then raise exception 'Invalid submission'; end if;
  insert into public.patients(full_name,document_type,document_ciphertext,document_key_version,document_fingerprint,document_last4,birth_date,email,phone)
  values(p_data->>'full_name',p_data->>'document_type',p_data->>'document_ciphertext',p_data->>'document_key_version',
   p_data->>'document_fingerprint',p_data->>'document_last4',(p_data->>'birth_date')::date,p_data->>'email',p_data->>'phone')
  returning id into patient;
  insert into public.exam_requests(patient_id,exam_type,privacy_notice_version,idempotency_key,submission_fingerprint)
  values(patient,p_data->>'exam_type',p_data->>'privacy_notice_version',(p_data->>'idempotency_key')::uuid,p_data->>'submission_fingerprint') returning * into request;
  insert into public.laboratory_integrations(exam_request_id) values(request.id);
  insert into public.integration_outbox(exam_request_id,idempotency_key,payload_reference) values(request.id,request.idempotency_key,request.id);
  insert into public.request_status_history(exam_request_id,new_status,change_source) values(request.id,'awaiting_review','public');
  insert into public.audit_logs(action,resource_type,resource_id) values('request.created','exam_request',request.id);
  return jsonb_build_object('protocol',request.protocol,'requestedAt',request.requested_at);
end $$;

create function public.update_request_status(p_id uuid,p_status text,p_reason text,p_scheduled_at timestamptz default null) returns void
language plpgsql security definer set search_path = '' as $$
declare previous text;
begin
  if not private.can_view_request(p_id) then raise exception 'Forbidden' using errcode='42501'; end if;
  if length(trim(p_reason)) not between 3 and 1000 then raise exception 'Reason required'; end if;
  select operational_status into previous from public.exam_requests where id=p_id for update;
  if previous in ('completed','cancelled') then raise exception 'Terminal status'; end if;
  if p_status not in ('awaiting_review','processing','scheduled','performed','completed','cancelled') or p_status=previous then raise exception 'Invalid transition'; end if;
  if (p_status='performed' and previous <> 'scheduled') or (p_status='completed' and previous <> 'performed')
    or (p_status='scheduled' and (p_scheduled_at is null or p_scheduled_at < now())) then raise exception 'Invalid transition'; end if;
  update public.exam_requests set operational_status=p_status,status_changed_at=now(),updated_at=now(),
    scheduled_at=case when p_status='scheduled' then p_scheduled_at else scheduled_at end where id=p_id;
  insert into public.request_status_history(exam_request_id,previous_status,new_status,actor_id,change_source,reason)
   values(p_id,previous,p_status,auth.uid(),'staff',trim(p_reason));
  insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
   values(auth.uid(),'request.status_changed','exam_request',p_id,jsonb_build_object('previous',previous,'next',p_status));
end $$;

create function public.add_request_comment(p_id uuid,p_content text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_view_request(p_id) then raise exception 'Forbidden' using errcode='42501'; end if;
  insert into public.patient_comments(exam_request_id,author_id,content) values(p_id,auth.uid(),trim(p_content));
  insert into public.audit_logs(actor_id,action,resource_type,resource_id) values(auth.uid(),'comment.created','exam_request',p_id);
end $$;
create function public.assign_request(p_id uuid,p_assignee uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_assignee is not null and not exists(select 1 from public.profiles where id=p_assignee and active) then raise exception 'Invalid assignee'; end if;
  update public.exam_requests set assigned_to=p_assignee,updated_at=now() where id=p_id;
  if not found then raise exception 'Not found'; end if;
  insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'request.assigned','exam_request',p_id,jsonb_build_object('assignee',p_assignee));
end $$;
create function public.record_manual_acceptance(p_id uuid,p_status text,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_status not in ('accepted','rejected') or length(trim(p_reason)) not between 10 and 1000 then raise exception 'Invalid manual confirmation'; end if;
  update public.exam_requests set laboratory_acceptance_status=p_status,acceptance_source='manual',acceptance_changed_at=now(),updated_at=now() where id=p_id;
  if not found then raise exception 'Not found'; end if;
  insert into public.request_status_history(exam_request_id,new_status,actor_id,change_source,reason) values(p_id,'laboratory_'||p_status,auth.uid(),'manual',trim(p_reason));
  insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'laboratory.manual_confirmation','exam_request',p_id,jsonb_build_object('acceptance',p_status));
end $$;

create function public.manage_staff_profile(p_actor uuid,p_id uuid,p_name text,p_email text,p_role text,p_active boolean,p_sensitive boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Service-only RPC: backend has already verified AAL2; actor is independently checked here.
  if p_actor=p_id or not exists(select 1 from public.profiles where id=p_actor and role='admin' and active) then raise exception 'Forbidden'; end if;
  insert into public.profiles(id,full_name,email,role,active,can_view_sensitive) values(p_id,p_name,p_email,p_role,p_active,p_sensitive)
  on conflict(id) do update set full_name=excluded.full_name,email=excluded.email,role=excluded.role,active=excluded.active,
    can_view_sensitive=excluded.can_view_sensitive,updated_at=now();
  insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(p_actor,'staff.access_changed','profile',p_id,jsonb_build_object('role',p_role,'active',p_active,'sensitive',p_sensitive));
end $$;

revoke all on function public.consume_rate_limit(text,integer,integer),public.submit_exam_request(jsonb),public.manage_staff_profile(uuid,uuid,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer),public.submit_exam_request(jsonb),public.manage_staff_profile(uuid,uuid,text,text,text,boolean,boolean) to service_role;
revoke all on function public.update_request_status(uuid,text,text,timestamptz),public.add_request_comment(uuid,text),public.assign_request(uuid,uuid),public.record_manual_acceptance(uuid,text,text) from public,anon;
grant execute on function public.update_request_status(uuid,text,text,timestamptz),public.add_request_comment(uuid,text),public.assign_request(uuid,uuid),public.record_manual_acceptance(uuid,text,text) to authenticated;

-- Atomic leases prevent two workers from processing the same outbox entry concurrently.
create function public.claim_integration_jobs(p_limit integer default 10) returns setof public.integration_outbox
language sql security definer set search_path = '' as $$
  with jobs as (update public.integration_outbox set status='sending',attempts=attempts+1,last_attempt_at=now(),locked_until=now()+interval '2 minutes',lease_token=gen_random_uuid()
  where id in (select id from public.integration_outbox
   where ((status in ('pending','failed') and coalesce(next_attempt_at,now())<=now()) or (status='sending' and locked_until<now())) and attempts<8
   order by created_at for update skip locked limit least(greatest(p_limit,1),25)) returning *),
  requests_updated as (update public.exam_requests set integration_status='sending',updated_at=now() where id in (select exam_request_id from jobs)),
  integrations_updated as (update public.laboratory_integrations as i set integration_status='sending',attempts=j.attempts,last_attempt_at=j.last_attempt_at,updated_at=now()
    from jobs as j where i.exam_request_id=j.exam_request_id)
  select * from jobs;
$$;
create function public.finish_integration_job(p_id uuid,p_lease uuid,p_success boolean,p_external_protocol text default null,p_error text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare job public.integration_outbox; next_try timestamptz; state text;
begin
  select * into job from public.integration_outbox where id=p_id and lease_token=p_lease and status='sending' for update;
  if not found then raise exception 'Invalid lease'; end if;
  state := case when p_success then 'sent' else 'failed' end;
  next_try := case when p_success then null else now()+make_interval(secs=>least(3600,power(2,job.attempts)::integer*30)) end;
  update public.integration_outbox set status=state,next_attempt_at=next_try,locked_until=null,lease_token=null,
   processed_at=case when p_success then now() else null end,last_error=case when p_success then null else left(p_error,120) end where id=p_id;
  update public.laboratory_integrations set integration_status=state,attempts=job.attempts,last_attempt_at=now(),next_attempt_at=next_try,
   last_error=case when p_success then null else left(p_error,120) end,external_protocol=coalesce(p_external_protocol,external_protocol),updated_at=now() where exam_request_id=job.exam_request_id;
  update public.exam_requests set integration_status=state,updated_at=now() where id=job.exam_request_id;
  insert into public.audit_logs(action,resource_type,resource_id,metadata) values('integration.'||state,'exam_request',job.exam_request_id,jsonb_build_object('attempt',job.attempts));
end $$;
create function public.apply_laboratory_event(p_event text,p_request uuid,p_acceptance text default null,p_operational text default null,p_scheduled_at timestamptz default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare previous text;
begin
  if length(p_event) not between 1 and 200 or (p_acceptance is not null and p_acceptance not in ('accepted','rejected'))
     or (p_operational is not null and p_operational not in ('processing','scheduled','performed','completed','cancelled')) then raise exception 'Invalid event'; end if;
  select operational_status into previous from public.exam_requests where id=p_request for update;
  if not found then raise exception 'Not found'; end if;
  if p_operational='scheduled' and p_scheduled_at is null then raise exception 'Missing schedule'; end if;
  insert into public.laboratory_events(external_event_id,exam_request_id,event_type) values(p_event,p_request,'status') on conflict(external_event_id) do nothing;
  if not found then return false; end if;
  update public.exam_requests set laboratory_acceptance_status=coalesce(p_acceptance,laboratory_acceptance_status),
   acceptance_source=case when p_acceptance is null then acceptance_source else 'api' end,
   acceptance_changed_at=case when p_acceptance is null then acceptance_changed_at else now() end,
   operational_status=coalesce(p_operational,operational_status),
   status_changed_at=case when p_operational is null or p_operational=previous then status_changed_at else now() end,
   scheduled_at=coalesce(p_scheduled_at,scheduled_at),integration_status='acknowledged',updated_at=now() where id=p_request;
  update public.laboratory_integrations set integration_status='acknowledged',updated_at=now() where exam_request_id=p_request;
  update public.integration_outbox set status='acknowledged',processed_at=now(),locked_until=null,lease_token=null where exam_request_id=p_request;
  insert into public.request_status_history(exam_request_id,previous_status,new_status,change_source) values(p_request,previous,coalesce(p_operational,'laboratory_'||p_acceptance,'acknowledged'),'api');
  insert into public.audit_logs(action,resource_type,resource_id) values('laboratory.event_received','exam_request',p_request);
  return true;
end $$;
revoke all on function public.claim_integration_jobs(integer),public.finish_integration_job(uuid,uuid,boolean,text,text),public.apply_laboratory_event(text,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_integration_jobs(integer),public.finish_integration_job(uuid,uuid,boolean,text,text),public.apply_laboratory_event(text,uuid,text,text,timestamptz) to service_role;
create function public.request_metrics() returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'total',count(*),'new',count(*) filter(where requested_at >= now()-interval '24 hours'),
    'awaiting_review',count(*) filter(where operational_status='awaiting_review'),
    'awaiting_lab',count(*) filter(where laboratory_acceptance_status='awaiting' and operational_status not in ('completed','cancelled')),
    'accepted',count(*) filter(where laboratory_acceptance_status='accepted'),
    'rejected',count(*) filter(where laboratory_acceptance_status='rejected'),
    'processing',count(*) filter(where operational_status='processing'),
    'scheduled',count(*) filter(where operational_status='scheduled'),
    'completed',count(*) filter(where operational_status='completed'),
    'integration_failed',count(*) filter(where integration_status='failed'),
    'average_wait_minutes',coalesce(round(avg(extract(epoch from (coalesce(acceptance_changed_at,now())-requested_at))/60)
      filter(where operational_status<>'cancelled')),0)
  ) from public.exam_requests;
$$;
revoke all on function public.request_metrics() from public,anon;
grant execute on function public.request_metrics() to authenticated;
commit;
