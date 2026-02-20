create table if not exists public.security_incidents (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  title text not null,
  description text,
  severity text not null default 'high' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'detected'
    check (status in ('detected', 'triaged', 'investigating', 'contained', 'notified', 'resolved', 'closed')),
  source text not null default 'internal_monitor',
  drill_mode boolean not null default true,
  requires_ftc_notice boolean not null default false,
  requires_gdpr_notice boolean not null default true,
  detected_at timestamptz not null default now(),
  ftc_notice_due_at timestamptz,
  gdpr_notice_due_at timestamptz,
  first_triaged_at timestamptz,
  investigation_started_at timestamptz,
  contained_at timestamptz,
  notified_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  affected_user_count integer not null default 0 check (affected_user_count >= 0),
  affected_gym_count integer not null default 0 check (affected_gym_count >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((not requires_ftc_notice) or ftc_notice_due_at is not null),
  check ((not requires_gdpr_notice) or gdpr_notice_due_at is not null),
  check (closed_at is null or resolved_at is not null)
);

create index if not exists idx_security_incidents_gym_status
  on public.security_incidents(gym_id, status, detected_at desc);

create index if not exists idx_security_incidents_deadline_ftc
  on public.security_incidents(ftc_notice_due_at)
  where requires_ftc_notice and status not in ('resolved', 'closed');

create index if not exists idx_security_incidents_deadline_gdpr
  on public.security_incidents(gdpr_notice_due_at)
  where requires_gdpr_notice and status not in ('resolved', 'closed');

create index if not exists idx_security_incidents_status_updated
  on public.security_incidents(status, updated_at desc);

drop trigger if exists trg_security_incidents_set_updated_at on public.security_incidents;
create trigger trg_security_incidents_set_updated_at
before update on public.security_incidents
for each row execute function public.set_updated_at();

create table if not exists public.incident_actions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.security_incidents(id) on delete cascade,
  action_type text not null check (
    action_type in (
      'created',
      'status_changed',
      'deadline_recomputed',
      'escalation_triggered',
      'notification_queued',
      'notification_sent',
      'notification_failed',
      'note_added'
    )
  ),
  action_note text,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  created_at timestamptz not null default now()
);

create index if not exists idx_incident_actions_incident_time
  on public.incident_actions(incident_id, created_at desc);

create index if not exists idx_incident_actions_type_time
  on public.incident_actions(action_type, created_at desc);

create table if not exists public.incident_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.security_incidents(id) on delete cascade,
  channel text not null check (channel in ('email', 'webhook')),
  destination text not null,
  template_key text not null default 'security_incident_notice_v1',
  payload jsonb not null default '{}'::jsonb,
  delivery_mode text not null check (delivery_mode in ('drill', 'live')),
  provider text not null default 'stub',
  status public.sync_job_status not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'retry_scheduled')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  response_payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_incident_notification_jobs_status_retry
  on public.incident_notification_jobs(status, next_attempt_at, created_at);

create index if not exists idx_incident_notification_jobs_incident_created
  on public.incident_notification_jobs(incident_id, created_at desc);

drop trigger if exists trg_incident_notification_jobs_set_updated_at on public.incident_notification_jobs;
create trigger trg_incident_notification_jobs_set_updated_at
before update on public.incident_notification_jobs
for each row execute function public.set_updated_at();

create or replace function public.is_incident_open_status(
  p_status text
)
returns boolean
language sql
immutable
as $$
  select p_status in ('detected', 'triaged', 'investigating', 'contained', 'notified');
$$;

create or replace function public.compute_incident_notice_deadlines(
  p_detected_at timestamptz,
  p_requires_ftc_notice boolean,
  p_requires_gdpr_notice boolean,
  p_ftc_deadline_hours integer default 1440,
  p_gdpr_deadline_hours integer default 72
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_detected_at timestamptz := p_detected_at;
  v_ftc_hours integer := greatest(1, least(coalesce(p_ftc_deadline_hours, 1440), 24 * 365));
  v_gdpr_hours integer := greatest(1, least(coalesce(p_gdpr_deadline_hours, 72), 24 * 365));
  v_ftc_due timestamptz := null;
  v_gdpr_due timestamptz := null;
begin
  if v_detected_at is null then
    raise exception 'Detected timestamp is required';
  end if;

  if coalesce(p_requires_ftc_notice, false) then
    v_ftc_due := v_detected_at + make_interval(hours => v_ftc_hours);
  end if;

  if coalesce(p_requires_gdpr_notice, false) then
    v_gdpr_due := v_detected_at + make_interval(hours => v_gdpr_hours);
  end if;

  return jsonb_build_object(
    'detected_at', v_detected_at,
    'ftc_notice_due_at', v_ftc_due,
    'gdpr_notice_due_at', v_gdpr_due,
    'ftc_deadline_hours', v_ftc_hours,
    'gdpr_deadline_hours', v_gdpr_hours
  );
end;
$$;

create or replace function public.can_view_security_incident(
  p_incident_id uuid,
  p_actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.security_incidents si
    where si.id = p_incident_id
      and (
        public.is_service_role()
        or (
          si.gym_id is not null
          and public.is_gym_staff(si.gym_id, p_actor_user_id)
        )
      )
  );
$$;

create or replace function public.create_security_incident(
  p_gym_id uuid,
  p_title text,
  p_description text default null,
  p_severity text default 'high',
  p_source text default 'internal_monitor',
  p_drill_mode boolean default true,
  p_requires_ftc_notice boolean default false,
  p_requires_gdpr_notice boolean default true,
  p_detected_at timestamptz default now(),
  p_ftc_deadline_hours integer default 1440,
  p_gdpr_deadline_hours integer default 72,
  p_affected_user_count integer default 0,
  p_affected_gym_count integer default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_title text := nullif(btrim(p_title), '');
  v_description text := nullif(btrim(p_description), '');
  v_severity text := lower(coalesce(nullif(btrim(p_severity), ''), 'high'));
  v_source text := coalesce(nullif(btrim(p_source), ''), 'internal_monitor');
  v_detected_at timestamptz := coalesce(p_detected_at, now());
  v_deadlines jsonb;
  v_ftc_due timestamptz;
  v_gdpr_due timestamptz;
  v_incident_id uuid;
  v_action_id uuid;
  v_actor_role text := coalesce(auth.jwt()->>'role', 'authenticated');
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if v_title is null then
    raise exception 'Incident title is required';
  end if;

  if jsonb_typeof(v_metadata) is distinct from 'object' then
    raise exception 'Incident metadata must be a JSON object';
  end if;

  if v_severity not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Invalid incident severity';
  end if;

  if not v_is_service then
    if v_actor is null then
      raise exception 'Authentication required';
    end if;

    if p_gym_id is null or not public.is_gym_staff(p_gym_id, v_actor) then
      raise exception 'Gym staff access is required';
    end if;
  end if;

  v_deadlines := public.compute_incident_notice_deadlines(
    v_detected_at,
    coalesce(p_requires_ftc_notice, false),
    coalesce(p_requires_gdpr_notice, true),
    p_ftc_deadline_hours,
    p_gdpr_deadline_hours
  );

  v_ftc_due := (v_deadlines->>'ftc_notice_due_at')::timestamptz;
  v_gdpr_due := (v_deadlines->>'gdpr_notice_due_at')::timestamptz;

  insert into public.security_incidents(
    gym_id,
    title,
    description,
    severity,
    status,
    source,
    drill_mode,
    requires_ftc_notice,
    requires_gdpr_notice,
    detected_at,
    ftc_notice_due_at,
    gdpr_notice_due_at,
    affected_user_count,
    affected_gym_count,
    created_by,
    updated_by,
    metadata
  )
  values (
    p_gym_id,
    v_title,
    v_description,
    v_severity,
    'detected',
    v_source,
    coalesce(p_drill_mode, true),
    coalesce(p_requires_ftc_notice, false),
    coalesce(p_requires_gdpr_notice, true),
    v_detected_at,
    v_ftc_due,
    v_gdpr_due,
    greatest(0, coalesce(p_affected_user_count, 0)),
    greatest(0, coalesce(p_affected_gym_count, 0)),
    v_actor,
    v_actor,
    v_metadata
  )
  returning id into v_incident_id;

  insert into public.incident_actions(
    incident_id,
    action_type,
    action_note,
    metadata,
    actor_user_id,
    actor_role
  )
  values (
    v_incident_id,
    'created',
    'Incident created',
    jsonb_build_object(
      'severity', v_severity,
      'source', v_source,
      'detected_at', v_detected_at,
      'drill_mode', coalesce(p_drill_mode, true),
      'requires_ftc_notice', coalesce(p_requires_ftc_notice, false),
      'requires_gdpr_notice', coalesce(p_requires_gdpr_notice, true),
      'ftc_notice_due_at', v_ftc_due,
      'gdpr_notice_due_at', v_gdpr_due
    ),
    v_actor,
    v_actor_role
  )
  returning id into v_action_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'incident.created',
    'security_incident',
    v_incident_id,
    jsonb_build_object(
      'incident_id', v_incident_id,
      'action_id', v_action_id,
      'gym_id', p_gym_id,
      'severity', v_severity,
      'status', 'detected',
      'drill_mode', coalesce(p_drill_mode, true),
      'detected_at', v_detected_at,
      'ftc_notice_due_at', v_ftc_due,
      'gdpr_notice_due_at', v_gdpr_due
    )
  );

  perform public.append_audit_log(
    'incident.created',
    'security_incidents',
    v_incident_id,
    'Security incident created',
    jsonb_build_object(
      'action_id', v_action_id,
      'severity', v_severity,
      'drill_mode', coalesce(p_drill_mode, true),
      'gym_id', p_gym_id,
      'detected_at', v_detected_at,
      'ftc_notice_due_at', v_ftc_due,
      'gdpr_notice_due_at', v_gdpr_due
    )
  );

  return v_incident_id;
end;
$$;

create or replace function public.transition_security_incident_status(
  p_incident_id uuid,
  p_next_status text,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_incident public.security_incidents%rowtype;
  v_next_status text := lower(coalesce(nullif(btrim(p_next_status), ''), ''));
  v_note text := nullif(btrim(p_note), '');
  v_now timestamptz := now();
  v_action_id uuid;
  v_actor_role text := coalesce(auth.jwt()->>'role', 'authenticated');
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if v_next_status not in ('detected', 'triaged', 'investigating', 'contained', 'notified', 'resolved', 'closed') then
    raise exception 'Invalid incident status: %', v_next_status;
  end if;

  if jsonb_typeof(v_metadata) is distinct from 'object' then
    raise exception 'Incident transition metadata must be a JSON object';
  end if;

  select *
  into v_incident
  from public.security_incidents si
  where si.id = p_incident_id
  for update;

  if v_incident.id is null then
    raise exception 'Security incident not found';
  end if;

  if not v_is_service then
    if v_actor is null then
      raise exception 'Authentication required';
    end if;

    if v_incident.gym_id is null or not public.is_gym_staff(v_incident.gym_id, v_actor) then
      raise exception 'Gym staff access is required';
    end if;
  end if;

  if v_incident.status = v_next_status then
    return v_incident.id;
  end if;

  if not (
    (v_incident.status = 'detected' and v_next_status in ('triaged', 'closed'))
    or (v_incident.status = 'triaged' and v_next_status in ('investigating', 'contained', 'closed'))
    or (v_incident.status = 'investigating' and v_next_status in ('contained', 'notified', 'resolved', 'closed'))
    or (v_incident.status = 'contained' and v_next_status in ('notified', 'resolved', 'closed'))
    or (v_incident.status = 'notified' and v_next_status in ('resolved', 'closed'))
    or (v_incident.status = 'resolved' and v_next_status in ('closed'))
  ) then
    raise exception 'Invalid incident status transition: % -> %', v_incident.status, v_next_status;
  end if;

  update public.security_incidents si
  set
    status = v_next_status,
    first_triaged_at = case
      when v_next_status = 'triaged' then coalesce(si.first_triaged_at, v_now)
      else si.first_triaged_at
    end,
    investigation_started_at = case
      when v_next_status = 'investigating' then coalesce(si.investigation_started_at, v_now)
      else si.investigation_started_at
    end,
    contained_at = case
      when v_next_status = 'contained' then coalesce(si.contained_at, v_now)
      else si.contained_at
    end,
    notified_at = case
      when v_next_status = 'notified' then coalesce(si.notified_at, v_now)
      else si.notified_at
    end,
    resolved_at = case
      when v_next_status = 'resolved' then coalesce(si.resolved_at, v_now)
      else si.resolved_at
    end,
    closed_at = case
      when v_next_status = 'closed' then coalesce(si.closed_at, v_now)
      else si.closed_at
    end,
    updated_by = coalesce(v_actor, si.updated_by),
    updated_at = v_now
  where si.id = v_incident.id;

  insert into public.incident_actions(
    incident_id,
    action_type,
    action_note,
    metadata,
    actor_user_id,
    actor_role
  )
  values (
    v_incident.id,
    'status_changed',
    coalesce(v_note, 'Incident status transition'),
    v_metadata || jsonb_build_object(
      'previous_status', v_incident.status,
      'next_status', v_next_status,
      'transitioned_at', v_now
    ),
    v_actor,
    v_actor_role
  )
  returning id into v_action_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'incident.status_changed',
    'security_incident',
    v_incident.id,
    jsonb_build_object(
      'incident_id', v_incident.id,
      'action_id', v_action_id,
      'previous_status', v_incident.status,
      'next_status', v_next_status,
      'at', v_now
    )
  );

  perform public.append_audit_log(
    'incident.status_changed',
    'security_incidents',
    v_incident.id,
    coalesce(v_note, 'Security incident status transitioned'),
    jsonb_build_object(
      'action_id', v_action_id,
      'previous_status', v_incident.status,
      'next_status', v_next_status,
      'transitioned_at', v_now
    )
  );

  return v_incident.id;
end;
$$;

create or replace function public.recompute_security_incident_deadlines(
  p_incident_id uuid,
  p_ftc_deadline_hours integer default 1440,
  p_gdpr_deadline_hours integer default 72,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_incident public.security_incidents%rowtype;
  v_deadlines jsonb;
  v_ftc_due timestamptz;
  v_gdpr_due timestamptz;
  v_action_id uuid;
  v_actor_role text := coalesce(auth.jwt()->>'role', 'authenticated');
  v_note text := nullif(btrim(p_note), '');
begin
  select *
  into v_incident
  from public.security_incidents si
  where si.id = p_incident_id
  for update;

  if v_incident.id is null then
    raise exception 'Security incident not found';
  end if;

  if not v_is_service then
    if v_actor is null then
      raise exception 'Authentication required';
    end if;

    if v_incident.gym_id is null or not public.is_gym_staff(v_incident.gym_id, v_actor) then
      raise exception 'Gym staff access is required';
    end if;
  end if;

  v_deadlines := public.compute_incident_notice_deadlines(
    v_incident.detected_at,
    v_incident.requires_ftc_notice,
    v_incident.requires_gdpr_notice,
    p_ftc_deadline_hours,
    p_gdpr_deadline_hours
  );

  v_ftc_due := (v_deadlines->>'ftc_notice_due_at')::timestamptz;
  v_gdpr_due := (v_deadlines->>'gdpr_notice_due_at')::timestamptz;

  update public.security_incidents si
  set
    ftc_notice_due_at = v_ftc_due,
    gdpr_notice_due_at = v_gdpr_due,
    updated_by = coalesce(v_actor, si.updated_by),
    updated_at = now()
  where si.id = v_incident.id;

  insert into public.incident_actions(
    incident_id,
    action_type,
    action_note,
    metadata,
    actor_user_id,
    actor_role
  )
  values (
    v_incident.id,
    'deadline_recomputed',
    coalesce(v_note, 'Regulatory notice deadlines recomputed'),
    jsonb_build_object(
      'ftc_notice_due_at', v_ftc_due,
      'gdpr_notice_due_at', v_gdpr_due,
      'ftc_deadline_hours', (v_deadlines->>'ftc_deadline_hours')::integer,
      'gdpr_deadline_hours', (v_deadlines->>'gdpr_deadline_hours')::integer
    ),
    v_actor,
    v_actor_role
  )
  returning id into v_action_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'incident.deadline_recomputed',
    'security_incident',
    v_incident.id,
    jsonb_build_object(
      'incident_id', v_incident.id,
      'action_id', v_action_id,
      'ftc_notice_due_at', v_ftc_due,
      'gdpr_notice_due_at', v_gdpr_due
    )
  );

  perform public.append_audit_log(
    'incident.deadline_recomputed',
    'security_incidents',
    v_incident.id,
    coalesce(v_note, 'Incident deadlines recomputed'),
    jsonb_build_object(
      'action_id', v_action_id,
      'ftc_notice_due_at', v_ftc_due,
      'gdpr_notice_due_at', v_gdpr_due
    )
  );

  return v_incident.id;
end;
$$;

create or replace function public.admin_list_security_incidents(
  p_gym_id uuid,
  p_limit integer default 50,
  p_status_filter text default null
)
returns table (
  id uuid,
  gym_id uuid,
  title text,
  severity text,
  status text,
  drill_mode boolean,
  detected_at timestamptz,
  requires_ftc_notice boolean,
  requires_gdpr_notice boolean,
  ftc_notice_due_at timestamptz,
  gdpr_notice_due_at timestamptz,
  next_deadline_at timestamptz,
  next_deadline_label text,
  seconds_to_next_deadline bigint,
  is_deadline_breached boolean,
  affected_user_count integer,
  affected_gym_count integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_status_filter text := lower(nullif(btrim(p_status_filter), ''));
begin
  if not v_is_service then
    if v_actor is null then
      raise exception 'Authentication required';
    end if;

    if p_gym_id is null then
      raise exception 'Gym id is required';
    end if;

    if not public.is_gym_staff(p_gym_id, v_actor) then
      raise exception 'Gym staff access is required';
    end if;
  end if;

  if v_status_filter is not null and v_status_filter not in (
    'detected', 'triaged', 'investigating', 'contained', 'notified', 'resolved', 'closed'
  ) then
    raise exception 'Invalid status filter';
  end if;

  return query
  with scoped as (
    select si.*
    from public.security_incidents si
    where (
      v_is_service
      and (p_gym_id is null or si.gym_id = p_gym_id)
    )
    or (
      not v_is_service
      and si.gym_id = p_gym_id
    )
  )
  select
    si.id,
    si.gym_id,
    si.title,
    si.severity,
    si.status,
    si.drill_mode,
    si.detected_at,
    si.requires_ftc_notice,
    si.requires_gdpr_notice,
    si.ftc_notice_due_at,
    si.gdpr_notice_due_at,
    d.next_deadline_at,
    case
      when d.next_deadline_at is null then null
      when si.requires_gdpr_notice and si.gdpr_notice_due_at = d.next_deadline_at then 'gdpr'
      when si.requires_ftc_notice and si.ftc_notice_due_at = d.next_deadline_at then 'ftc'
      else 'mixed'
    end as next_deadline_label,
    case
      when d.next_deadline_at is null then null
      else extract(epoch from (d.next_deadline_at - now()))::bigint
    end as seconds_to_next_deadline,
    case
      when d.next_deadline_at is null then false
      when si.status in ('resolved', 'closed') then false
      else d.next_deadline_at < now()
    end as is_deadline_breached,
    si.affected_user_count,
    si.affected_gym_count,
    si.updated_at
  from scoped si
  cross join lateral (
    select min(deadline_at) as next_deadline_at
    from (
      values
        (case when si.requires_ftc_notice then si.ftc_notice_due_at else null end),
        (case when si.requires_gdpr_notice then si.gdpr_notice_due_at else null end)
    ) as deadlines(deadline_at)
  ) d
  where v_status_filter is null or si.status = v_status_filter
  order by
    (case
      when d.next_deadline_at is null then 1
      when si.status in ('resolved', 'closed') then 1
      when d.next_deadline_at < now() then 0
      else 1
    end) asc,
    d.next_deadline_at asc nulls last,
    si.detected_at desc
  limit v_limit;
end;
$$;

create or replace function public.queue_incident_escalation_notifications(
  p_incident_id uuid,
  p_reason text default null,
  p_channels text[] default array['email'::text, 'webhook'::text],
  p_email_destination text default null,
  p_webhook_destination text default null,
  p_payload jsonb default '{}'::jsonb,
  p_force_live boolean default false,
  p_template_key text default 'security_incident_notice_v1'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_incident public.security_incidents%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_template_key text := coalesce(nullif(btrim(p_template_key), ''), 'security_incident_notice_v1');
  v_delivery_mode text;
  v_channels text[] := coalesce(p_channels, array['email'::text, 'webhook'::text]);
  v_channel text;
  v_destination text;
  v_count integer := 0;
  v_now timestamptz := now();
  v_action_id uuid;
  v_actor_role text := coalesce(auth.jwt()->>'role', 'authenticated');
begin
  if jsonb_typeof(v_payload) is distinct from 'object' then
    raise exception 'Escalation payload must be a JSON object';
  end if;

  select *
  into v_incident
  from public.security_incidents si
  where si.id = p_incident_id
  for update;

  if v_incident.id is null then
    raise exception 'Security incident not found';
  end if;

  if not v_is_service then
    if v_actor is null then
      raise exception 'Authentication required';
    end if;

    if v_incident.gym_id is null or not public.is_gym_staff(v_incident.gym_id, v_actor) then
      raise exception 'Gym staff access is required';
    end if;
  end if;

  if v_incident.status in ('resolved', 'closed') then
    raise exception 'Cannot queue escalation for resolved or closed incident';
  end if;

  v_delivery_mode := case
    when coalesce(p_force_live, false) then 'live'
    when v_incident.drill_mode then 'drill'
    else 'live'
  end;

  for v_channel in
    select distinct lower(btrim(raw_channel))
    from unnest(v_channels) as raw_channel
    where nullif(btrim(raw_channel), '') is not null
  loop
    if v_channel = 'email' then
      v_destination := coalesce(nullif(btrim(p_email_destination), ''), 'compliance-drill@kruxt.local');
    elsif v_channel = 'webhook' then
      v_destination := coalesce(nullif(btrim(p_webhook_destination), ''), 'https://example.invalid/kruxt/incident');
    else
      raise exception 'Unsupported incident notification channel: %', v_channel;
    end if;

    insert into public.incident_notification_jobs(
      incident_id,
      channel,
      destination,
      template_key,
      payload,
      delivery_mode,
      provider,
      status,
      next_attempt_at,
      created_by
    )
    values (
      v_incident.id,
      v_channel,
      v_destination,
      v_template_key,
      v_payload || jsonb_build_object(
        'incident_id', v_incident.id,
        'incident_title', v_incident.title,
        'incident_status', v_incident.status,
        'incident_severity', v_incident.severity,
        'reason', v_reason,
        'queued_at', v_now
      ),
      v_delivery_mode,
      'stub',
      'queued'::public.sync_job_status,
      v_now,
      v_actor
    );

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'At least one escalation channel is required';
  end if;

  insert into public.incident_actions(
    incident_id,
    action_type,
    action_note,
    metadata,
    actor_user_id,
    actor_role
  )
  values (
    v_incident.id,
    'escalation_triggered',
    coalesce(v_reason, 'Incident escalation jobs queued'),
    jsonb_build_object(
      'job_count', v_count,
      'delivery_mode', v_delivery_mode,
      'channels', v_channels,
      'template_key', v_template_key,
      'queued_at', v_now
    ),
    v_actor,
    v_actor_role
  )
  returning id into v_action_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'incident.escalation_triggered',
    'security_incident',
    v_incident.id,
    jsonb_build_object(
      'incident_id', v_incident.id,
      'action_id', v_action_id,
      'job_count', v_count,
      'delivery_mode', v_delivery_mode,
      'channels', v_channels,
      'queued_at', v_now
    )
  );

  perform public.append_audit_log(
    'incident.escalation_triggered',
    'security_incidents',
    v_incident.id,
    coalesce(v_reason, 'Incident escalation queued'),
    jsonb_build_object(
      'action_id', v_action_id,
      'job_count', v_count,
      'delivery_mode', v_delivery_mode,
      'channels', v_channels
    )
  );

  return v_count;
end;
$$;

create or replace function public.claim_incident_notification_jobs(
  p_limit integer default 20
)
returns setof public.incident_notification_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  return query
  with candidates as (
    select j.id
    from public.incident_notification_jobs j
    where j.status in ('queued', 'retry_scheduled')
      and coalesce(j.next_attempt_at, j.created_at) <= now()
    order by coalesce(j.next_attempt_at, j.created_at) asc
    limit v_limit
    for update of j skip locked
  ),
  updated as (
    update public.incident_notification_jobs j
    set
      status = 'running',
      started_at = now(),
      finished_at = null,
      last_error = null,
      updated_at = now()
    from candidates c
    where j.id = c.id
    returning j.*
  )
  select *
  from updated;
end;
$$;

create or replace function public.complete_incident_notification_job(
  p_job_id uuid,
  p_response_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.incident_notification_jobs%rowtype;
  v_incident public.security_incidents%rowtype;
  v_response_payload jsonb := coalesce(p_response_payload, '{}'::jsonb);
  v_action_id uuid;
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  if jsonb_typeof(v_response_payload) is distinct from 'object' then
    raise exception 'Notification response payload must be a JSON object';
  end if;

  select *
  into v_job
  from public.incident_notification_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'Incident notification job not found';
  end if;

  if v_job.status <> 'running' then
    raise exception 'Incident notification job must be running before completion';
  end if;

  select *
  into v_incident
  from public.security_incidents si
  where si.id = v_job.incident_id
  for update;

  if v_incident.id is null then
    raise exception 'Security incident not found for notification job';
  end if;

  update public.incident_notification_jobs j
  set
    status = 'succeeded',
    attempt_count = coalesce(j.attempt_count, 0) + 1,
    response_payload = v_response_payload,
    finished_at = now(),
    next_attempt_at = null,
    last_error = null,
    updated_at = now()
  where j.id = v_job.id;

  insert into public.incident_actions(
    incident_id,
    action_type,
    action_note,
    metadata,
    actor_user_id,
    actor_role
  )
  values (
    v_incident.id,
    'notification_sent',
    'Incident notification job succeeded',
    jsonb_build_object(
      'job_id', v_job.id,
      'channel', v_job.channel,
      'delivery_mode', v_job.delivery_mode,
      'provider', v_job.provider,
      'destination', v_job.destination,
      'response_payload', v_response_payload
    ),
    null,
    'service_role'
  )
  returning id into v_action_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'incident.notification_delivered',
    'security_incident',
    v_incident.id,
    jsonb_build_object(
      'incident_id', v_incident.id,
      'action_id', v_action_id,
      'job_id', v_job.id,
      'channel', v_job.channel,
      'delivery_mode', v_job.delivery_mode,
      'provider', v_job.provider
    )
  );

  perform public.append_audit_log(
    'incident.notification_delivered',
    'incident_notification_jobs',
    v_job.id,
    'Incident notification job completed',
    jsonb_build_object(
      'incident_id', v_incident.id,
      'action_id', v_action_id,
      'channel', v_job.channel,
      'delivery_mode', v_job.delivery_mode,
      'provider', v_job.provider
    )
  );

  return v_incident.id;
end;
$$;

create or replace function public.fail_incident_notification_job(
  p_job_id uuid,
  p_error text,
  p_retry_delay_seconds integer default 900,
  p_max_retries integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.incident_notification_jobs%rowtype;
  v_incident public.security_incidents%rowtype;
  v_error text := coalesce(nullif(btrim(p_error), ''), 'Unknown incident notification error');
  v_retry_delay integer := greatest(60, least(coalesce(p_retry_delay_seconds, 900), 86400));
  v_max_retries integer := greatest(1, least(coalesce(p_max_retries, 5), 20));
  v_attempt_count integer;
  v_next_retry_at timestamptz;
  v_final_failure boolean := false;
  v_action_id uuid;
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  select *
  into v_job
  from public.incident_notification_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'Incident notification job not found';
  end if;

  select *
  into v_incident
  from public.security_incidents si
  where si.id = v_job.incident_id
  for update;

  if v_incident.id is null then
    raise exception 'Security incident not found for notification job';
  end if;

  v_attempt_count := coalesce(v_job.attempt_count, 0) + 1;
  v_final_failure := v_attempt_count >= v_max_retries;

  if v_final_failure then
    update public.incident_notification_jobs j
    set
      status = 'failed',
      attempt_count = v_attempt_count,
      last_error = v_error,
      next_attempt_at = null,
      finished_at = now(),
      updated_at = now()
    where j.id = v_job.id;

    insert into public.incident_actions(
      incident_id,
      action_type,
      action_note,
      metadata,
      actor_user_id,
      actor_role
    )
    values (
      v_incident.id,
      'notification_failed',
      'Incident notification failed after max retries',
      jsonb_build_object(
        'job_id', v_job.id,
        'channel', v_job.channel,
        'delivery_mode', v_job.delivery_mode,
        'attempt_count', v_attempt_count,
        'max_retries', v_max_retries,
        'error', v_error,
        'final_failure', true
      ),
      null,
      'service_role'
    )
    returning id into v_action_id;

    insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
    values (
      'incident.notification_failed',
      'security_incident',
      v_incident.id,
      jsonb_build_object(
        'incident_id', v_incident.id,
        'action_id', v_action_id,
        'job_id', v_job.id,
        'channel', v_job.channel,
        'delivery_mode', v_job.delivery_mode,
        'attempt_count', v_attempt_count,
        'max_retries', v_max_retries,
        'error', v_error,
        'final_failure', true
      )
    );

    perform public.append_audit_log(
      'incident.notification_failed',
      'incident_notification_jobs',
      v_job.id,
      'Incident notification failed after max retries',
      jsonb_build_object(
        'incident_id', v_incident.id,
        'action_id', v_action_id,
        'channel', v_job.channel,
        'delivery_mode', v_job.delivery_mode,
        'attempt_count', v_attempt_count,
        'max_retries', v_max_retries,
        'error', v_error,
        'final_failure', true
      )
    );

    return jsonb_build_object(
      'status', 'failed',
      'attemptCount', v_attempt_count,
      'finalFailure', true
    );
  end if;

  v_next_retry_at := now() + make_interval(secs => v_retry_delay);

  update public.incident_notification_jobs j
  set
    status = 'retry_scheduled',
    attempt_count = v_attempt_count,
    last_error = v_error,
    next_attempt_at = v_next_retry_at,
    updated_at = now()
  where j.id = v_job.id;

  return jsonb_build_object(
    'status', 'retry_scheduled',
    'attemptCount', v_attempt_count,
    'nextRetryAt', v_next_retry_at,
    'finalFailure', false
  );
end;
$$;

alter table public.security_incidents enable row level security;
alter table public.incident_actions enable row level security;
alter table public.incident_notification_jobs enable row level security;

drop policy if exists security_incidents_select_service_or_staff on public.security_incidents;
create policy security_incidents_select_service_or_staff
on public.security_incidents for select to authenticated
using (
  public.is_service_role()
  or (
    gym_id is not null
    and public.is_gym_staff(gym_id, auth.uid())
  )
);

drop policy if exists security_incidents_manage_service on public.security_incidents;
create policy security_incidents_manage_service
on public.security_incidents for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists incident_actions_select_service_or_staff on public.incident_actions;
create policy incident_actions_select_service_or_staff
on public.incident_actions for select to authenticated
using (public.can_view_security_incident(incident_id, auth.uid()));

drop policy if exists incident_actions_manage_service on public.incident_actions;
create policy incident_actions_manage_service
on public.incident_actions for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists incident_notification_jobs_select_service on public.incident_notification_jobs;
create policy incident_notification_jobs_select_service
on public.incident_notification_jobs for select to authenticated
using (public.is_service_role());

drop policy if exists incident_notification_jobs_manage_service on public.incident_notification_jobs;
create policy incident_notification_jobs_manage_service
on public.incident_notification_jobs for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop trigger if exists trg_incident_actions_immutable on public.incident_actions;
create trigger trg_incident_actions_immutable
before update or delete on public.incident_actions
for each row execute function public.reject_mutation_immutable_table();

revoke all on function public.is_incident_open_status(text) from public;
grant execute on function public.is_incident_open_status(text) to authenticated;
grant execute on function public.is_incident_open_status(text) to service_role;

revoke all on function public.compute_incident_notice_deadlines(
  timestamptz,
  boolean,
  boolean,
  integer,
  integer
) from public;
grant execute on function public.compute_incident_notice_deadlines(
  timestamptz,
  boolean,
  boolean,
  integer,
  integer
) to authenticated;
grant execute on function public.compute_incident_notice_deadlines(
  timestamptz,
  boolean,
  boolean,
  integer,
  integer
) to service_role;

revoke all on function public.can_view_security_incident(uuid, uuid) from public;
grant execute on function public.can_view_security_incident(uuid, uuid) to authenticated;
grant execute on function public.can_view_security_incident(uuid, uuid) to service_role;

revoke all on function public.create_security_incident(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  timestamptz,
  integer,
  integer,
  integer,
  integer,
  jsonb
) from public;
grant execute on function public.create_security_incident(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  timestamptz,
  integer,
  integer,
  integer,
  integer,
  jsonb
) to authenticated;
grant execute on function public.create_security_incident(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  timestamptz,
  integer,
  integer,
  integer,
  integer,
  jsonb
) to service_role;

revoke all on function public.transition_security_incident_status(
  uuid,
  text,
  text,
  jsonb
) from public;
grant execute on function public.transition_security_incident_status(
  uuid,
  text,
  text,
  jsonb
) to authenticated;
grant execute on function public.transition_security_incident_status(
  uuid,
  text,
  text,
  jsonb
) to service_role;

revoke all on function public.recompute_security_incident_deadlines(
  uuid,
  integer,
  integer,
  text
) from public;
grant execute on function public.recompute_security_incident_deadlines(
  uuid,
  integer,
  integer,
  text
) to authenticated;
grant execute on function public.recompute_security_incident_deadlines(
  uuid,
  integer,
  integer,
  text
) to service_role;

revoke all on function public.admin_list_security_incidents(uuid, integer, text) from public;
grant execute on function public.admin_list_security_incidents(uuid, integer, text) to authenticated;
grant execute on function public.admin_list_security_incidents(uuid, integer, text) to service_role;

revoke all on function public.queue_incident_escalation_notifications(
  uuid,
  text,
  text[],
  text,
  text,
  jsonb,
  boolean,
  text
) from public;
grant execute on function public.queue_incident_escalation_notifications(
  uuid,
  text,
  text[],
  text,
  text,
  jsonb,
  boolean,
  text
) to authenticated;
grant execute on function public.queue_incident_escalation_notifications(
  uuid,
  text,
  text[],
  text,
  text,
  jsonb,
  boolean,
  text
) to service_role;

revoke all on function public.claim_incident_notification_jobs(integer) from public;
grant execute on function public.claim_incident_notification_jobs(integer) to service_role;

revoke all on function public.complete_incident_notification_job(uuid, jsonb) from public;
grant execute on function public.complete_incident_notification_job(uuid, jsonb) to service_role;

revoke all on function public.fail_incident_notification_job(
  uuid,
  text,
  integer,
  integer
) from public;
grant execute on function public.fail_incident_notification_job(
  uuid,
  text,
  integer,
  integer
) to service_role;
