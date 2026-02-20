create table if not exists public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  privacy_request_id uuid references public.privacy_requests(id) on delete set null,
  hold_type text not null check (
    hold_type in (
      'litigation',
      'fraud_investigation',
      'payment_dispute',
      'safety_incident',
      'regulatory_inquiry',
      'other'
    )
  ),
  reason text not null,
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  released_by uuid references public.profiles(id) on delete set null,
  released_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index if not exists idx_legal_holds_user_active
  on public.legal_holds(user_id, is_active, starts_at desc);

create index if not exists idx_legal_holds_request
  on public.legal_holds(privacy_request_id);

drop trigger if exists trg_legal_holds_set_updated_at on public.legal_holds;
create trigger trg_legal_holds_set_updated_at
before update on public.legal_holds
for each row execute function public.set_updated_at();

create table if not exists public.privacy_delete_jobs (
  id uuid primary key default gen_random_uuid(),
  privacy_request_id uuid not null references public.privacy_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.sync_job_status not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'retry_scheduled')),
  anonymization_summary jsonb not null default '{}'::jsonb,
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (privacy_request_id)
);

create index if not exists idx_privacy_delete_jobs_status_retry
  on public.privacy_delete_jobs(status, next_retry_at, created_at);

create index if not exists idx_privacy_delete_jobs_user_created
  on public.privacy_delete_jobs(user_id, created_at desc);

drop trigger if exists trg_privacy_delete_jobs_set_updated_at on public.privacy_delete_jobs;
create trigger trg_privacy_delete_jobs_set_updated_at
before update on public.privacy_delete_jobs
for each row execute function public.set_updated_at();

create or replace function public.can_manage_privacy_user(
  p_target_user_id uuid,
  p_actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_service_role()
    or (
      p_actor_user_id is not null
      and p_actor_user_id = p_target_user_id
    )
    or exists (
      select 1
      from public.gym_memberships gm_actor
      join public.gym_memberships gm_target
        on gm_target.gym_id = gm_actor.gym_id
       and gm_target.user_id = p_target_user_id
       and gm_target.membership_status in ('trial', 'active')
      where gm_actor.user_id = p_actor_user_id
        and gm_actor.membership_status in ('trial', 'active')
        and gm_actor.role in ('leader', 'officer', 'coach')
    );
$$;

create or replace function public.can_staff_manage_privacy_user(
  p_target_user_id uuid,
  p_actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_service_role()
    or exists (
      select 1
      from public.gym_memberships gm_actor
      join public.gym_memberships gm_target
        on gm_target.gym_id = gm_actor.gym_id
       and gm_target.user_id = p_target_user_id
       and gm_target.membership_status in ('trial', 'active')
      where gm_actor.user_id = p_actor_user_id
        and gm_actor.membership_status in ('trial', 'active')
        and gm_actor.role in ('leader', 'officer', 'coach')
    );
$$;

create or replace function public.has_active_legal_hold(
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target_user uuid := coalesce(p_user_id, v_actor);
begin
  if v_target_user is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_manage_privacy_user(v_target_user, v_actor) then
    raise exception 'Cannot inspect legal hold status for this user';
  end if;

  return exists (
    select 1
    from public.legal_holds h
    where h.user_id = v_target_user
      and h.is_active
      and h.starts_at <= now()
      and (h.ends_at is null or h.ends_at > now())
  );
end;
$$;

create or replace function public.apply_user_anonymization(
  p_user_id uuid,
  p_privacy_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := p_user_id;
  v_request_id uuid := p_privacy_request_id;
  v_now timestamptz := now();
  v_anonymized_username text;
  v_count integer := 0;
  v_summary jsonb := '{}'::jsonb;
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  if v_user_id is null then
    raise exception 'User id is required';
  end if;

  if public.has_active_legal_hold(v_user_id) then
    raise exception 'Cannot anonymize user with an active legal hold';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
    for update
  ) then
    raise exception 'Profile not found for user %', v_user_id;
  end if;

  v_anonymized_username := left('deleted_' || replace(v_user_id::text, '-', ''), 24);

  update public.profiles p
  set
    username = v_anonymized_username,
    display_name = 'Deleted User',
    avatar_url = null,
    bio = null,
    home_gym_id = null,
    is_public = false,
    xp_total = 0,
    level = 1,
    rank_tier = 'initiate',
    chain_days = 0,
    last_workout_at = null,
    locale = null,
    preferred_units = 'metric',
    updated_at = v_now
  where p.id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('profiles_updated', v_count);

  delete from public.social_connections sc
  where sc.follower_user_id = v_user_id
     or sc.followed_user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('social_connections_deleted', v_count);

  delete from public.user_blocks ub
  where ub.blocker_user_id = v_user_id
     or ub.blocked_user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('user_blocks_deleted', v_count);

  delete from public.user_reports ur
  where ur.reporter_user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('user_reports_deleted', v_count);

  delete from public.social_interactions si
  where si.actor_user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('social_interactions_deleted', v_count);

  delete from public.feed_events fe
  where fe.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('feed_events_deleted', v_count);

  delete from public.workouts w
  where w.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('workouts_deleted', v_count);

  delete from public.challenge_participants cp
  where cp.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('challenge_participants_deleted', v_count);

  delete from public.leaderboard_entries le
  where le.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('leaderboard_entries_deleted', v_count);

  delete from public.class_waitlist cw
  where cw.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('class_waitlist_deleted', v_count);

  delete from public.class_bookings cb
  where cb.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('class_bookings_deleted', v_count);

  delete from public.gym_checkins gc
  where gc.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('gym_checkins_deleted', v_count);

  update public.access_logs al
  set user_id = null
  where al.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('access_logs_anonymized', v_count);

  update public.payment_transactions pt
  set user_id = null,
      updated_at = v_now
  where pt.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('payment_transactions_anonymized', v_count);

  update public.notification_preferences np
  set
    push_enabled = false,
    email_enabled = false,
    in_app_enabled = false,
    marketing_enabled = false,
    workout_reactions_enabled = false,
    comments_enabled = false,
    challenge_updates_enabled = false,
    class_reminders_enabled = false,
    quiet_hours_start = null,
    quiet_hours_end = null,
    timezone = 'UTC',
    updated_at = v_now
  where np.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('notification_preferences_anonymized', v_count);

  delete from public.push_notification_tokens pnt
  where pnt.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('push_tokens_deleted', v_count);

  delete from public.device_connections dc
  where dc.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('device_connections_deleted', v_count);

  update public.waiver_acceptances wa
  set
    ip_address = null,
    user_agent = null,
    signature_data = '{}'::jsonb
  where wa.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('waiver_acceptances_anonymized', v_count);

  update public.contract_acceptances ca
  set
    ip_address = null,
    user_agent = null,
    signature_data = '{}'::jsonb
  where ca.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('contract_acceptances_anonymized', v_count);

  update public.privacy_requests pr
  set
    reason = null,
    notes = case when pr.id = v_request_id then pr.notes else null end,
    response_location = null,
    response_expires_at = null,
    response_content_type = null,
    response_bytes = null,
    updated_at = v_now
  where pr.user_id = v_user_id;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('privacy_requests_redacted', v_count);

  update public.privacy_export_jobs pej
  set
    signed_url = null,
    signed_url_expires_at = v_now,
    updated_at = v_now
  where pej.user_id = v_user_id
    and pej.signed_url is not null;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('privacy_export_links_revoked', v_count);

  v_summary := v_summary || jsonb_build_object(
    'user_id', v_user_id,
    'privacy_request_id', v_request_id,
    'anonymized_at', v_now,
    'anonymized_username', v_anonymized_username
  );

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'privacy.user_anonymized',
    'profile',
    v_user_id,
    v_summary
  );

  perform public.append_audit_log(
    'privacy.user_anonymized',
    'profiles',
    v_user_id,
    'User profile and related data anonymized',
    v_summary
  );

  return v_summary;
end;
$$;

create or replace function public.queue_privacy_delete_jobs(
  p_limit integer default 25
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 200));
  v_count integer := 0;
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  with candidates as (
    select
      pr.id as privacy_request_id,
      pr.user_id
    from public.privacy_requests pr
    where pr.request_type = 'delete'
      and pr.status in ('submitted', 'triaged', 'in_progress', 'in_review')
      and pr.resolved_at is null
      and not exists (
        select 1
        from public.privacy_delete_jobs j
        where j.privacy_request_id = pr.id
          and j.status in ('queued', 'running', 'retry_scheduled', 'succeeded')
      )
    order by pr.submitted_at asc
    limit v_limit
  )
  insert into public.privacy_delete_jobs(
    privacy_request_id,
    user_id,
    status,
    next_retry_at
  )
  select
    c.privacy_request_id,
    c.user_id,
    'queued'::public.sync_job_status,
    now()
  from candidates c
  on conflict (privacy_request_id)
  do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.claim_privacy_delete_jobs(
  p_limit integer default 5
)
returns setof public.privacy_delete_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 50));
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  return query
  with candidates as (
    select j.id
    from public.privacy_delete_jobs j
    join public.privacy_requests pr
      on pr.id = j.privacy_request_id
    where j.status in ('queued', 'retry_scheduled')
      and coalesce(j.next_retry_at, j.created_at) <= now()
      and pr.request_type = 'delete'
      and public.is_privacy_request_open_status(pr.status)
    order by coalesce(j.next_retry_at, j.created_at) asc
    limit v_limit
    for update of j skip locked
  ),
  updated as (
    update public.privacy_delete_jobs j
    set
      status = 'running',
      started_at = now(),
      finished_at = null,
      error_message = null,
      updated_at = now()
    from candidates c
    where j.id = c.id
    returning j.*
  )
  select *
  from updated;
end;
$$;

create or replace function public.complete_privacy_delete_job(
  p_job_id uuid,
  p_anonymization_summary jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.privacy_delete_jobs%rowtype;
  v_request public.privacy_requests%rowtype;
  v_summary jsonb := coalesce(p_anonymization_summary, '{}'::jsonb);
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  if jsonb_typeof(v_summary) is distinct from 'object' then
    raise exception 'Anonymization summary must be a JSON object';
  end if;

  select *
  into v_job
  from public.privacy_delete_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'Privacy delete job not found';
  end if;

  if v_job.status <> 'running' then
    raise exception 'Privacy delete job must be running before completion';
  end if;

  if public.has_active_legal_hold(v_job.user_id) then
    raise exception 'Cannot complete delete job while legal hold is active';
  end if;

  select *
  into v_request
  from public.privacy_requests pr
  where pr.id = v_job.privacy_request_id
  for update;

  if v_request.id is null then
    raise exception 'Privacy request not found for delete job';
  end if;

  if v_request.status = 'submitted' then
    perform public.transition_privacy_request_status(
      v_request.id,
      'triaged',
      'Delete queue promoted request'
    );
    v_request.status := 'triaged';
  end if;

  if v_request.status = 'triaged' then
    perform public.transition_privacy_request_status(
      v_request.id,
      'in_progress',
      'Delete/anonymization processing started'
    );
    v_request.status := 'in_progress';
  end if;

  if v_request.status in ('in_progress', 'in_review') then
    perform public.transition_privacy_request_status(
      v_request.id,
      'fulfilled',
      'Delete/anonymization completed'
    );
  elsif v_request.status = 'rejected' then
    raise exception 'Cannot complete delete for rejected privacy request';
  end if;

  update public.privacy_delete_jobs j
  set
    status = 'succeeded',
    anonymization_summary = v_summary,
    finished_at = now(),
    next_retry_at = null,
    error_message = null,
    updated_at = now()
  where j.id = v_job.id;

  update public.privacy_requests pr
  set
    response_location = null,
    response_expires_at = null,
    response_content_type = 'application/json',
    response_bytes = null,
    updated_at = now()
  where pr.id = v_request.id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'privacy.delete_completed',
    'privacy_request',
    v_request.id,
    jsonb_build_object(
      'request_id', v_request.id,
      'job_id', v_job.id,
      'user_id', v_job.user_id,
      'anonymization_summary', v_summary
    )
  );

  perform public.append_audit_log(
    'privacy.delete_completed',
    'privacy_delete_jobs',
    v_job.id,
    'Privacy delete/anonymization completed',
    jsonb_build_object(
      'request_id', v_request.id,
      'user_id', v_job.user_id,
      'anonymization_summary', v_summary
    )
  );

  return v_request.id;
end;
$$;

create or replace function public.fail_privacy_delete_job(
  p_job_id uuid,
  p_error text,
  p_retry_delay_seconds integer default 900,
  p_max_retries integer default 5,
  p_force_final boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.privacy_delete_jobs%rowtype;
  v_request public.privacy_requests%rowtype;
  v_error text := coalesce(nullif(btrim(p_error), ''), 'Unknown delete processing error');
  v_retry_delay integer := greatest(60, least(coalesce(p_retry_delay_seconds, 900), 86400));
  v_max_retries integer := greatest(1, least(coalesce(p_max_retries, 5), 20));
  v_retry_count integer;
  v_next_retry_at timestamptz;
  v_final_failure boolean := false;
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  select *
  into v_job
  from public.privacy_delete_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'Privacy delete job not found';
  end if;

  v_retry_count := coalesce(v_job.retry_count, 0) + 1;
  v_final_failure := coalesce(p_force_final, false) or v_retry_count >= v_max_retries;

  if v_final_failure then
    update public.privacy_delete_jobs j
    set
      status = 'failed',
      retry_count = v_retry_count,
      error_message = v_error,
      next_retry_at = null,
      finished_at = now(),
      updated_at = now()
    where j.id = v_job.id;

    select *
    into v_request
    from public.privacy_requests pr
    where pr.id = v_job.privacy_request_id
    for update;

    if v_request.id is not null and public.is_privacy_request_open_status(v_request.status) then
      if v_request.status = 'submitted' then
        perform public.transition_privacy_request_status(
          v_request.id,
          'triaged',
          'Delete queue promoted request'
        );
        v_request.status := 'triaged';
      end if;

      if v_request.status = 'triaged' then
        perform public.transition_privacy_request_status(
          v_request.id,
          'in_progress',
          'Delete/anonymization processing started'
        );
        v_request.status := 'in_progress';
      end if;

      if v_request.status in ('in_progress', 'in_review') then
        perform public.transition_privacy_request_status(
          v_request.id,
          'rejected',
          'Delete/anonymization failed after max retries'
        );
      end if;
    end if;

    insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
    values (
      'privacy.delete_failed',
      'privacy_request',
      v_job.privacy_request_id,
      jsonb_build_object(
        'request_id', v_job.privacy_request_id,
        'job_id', v_job.id,
        'user_id', v_job.user_id,
        'retry_count', v_retry_count,
        'max_retries', v_max_retries,
        'final_failure', true,
        'error', v_error
      )
    );

    perform public.append_audit_log(
      'privacy.delete_failed',
      'privacy_delete_jobs',
      v_job.id,
      'Privacy delete/anonymization failed after max retries',
      jsonb_build_object(
        'request_id', v_job.privacy_request_id,
        'user_id', v_job.user_id,
        'retry_count', v_retry_count,
        'max_retries', v_max_retries,
        'final_failure', true,
        'error', v_error
      )
    );

    return jsonb_build_object(
      'status', 'failed',
      'retryCount', v_retry_count,
      'finalFailure', true
    );
  end if;

  v_next_retry_at := now() + make_interval(secs => v_retry_delay);

  update public.privacy_delete_jobs j
  set
    status = 'retry_scheduled',
    retry_count = v_retry_count,
    error_message = v_error,
    next_retry_at = v_next_retry_at,
    updated_at = now()
  where j.id = v_job.id;

  return jsonb_build_object(
    'status', 'retry_scheduled',
    'retryCount', v_retry_count,
    'nextRetryAt', v_next_retry_at,
    'finalFailure', false
  );
end;
$$;

alter table public.legal_holds enable row level security;
alter table public.privacy_delete_jobs enable row level security;

drop policy if exists legal_holds_select_self_staff_or_service on public.legal_holds;
create policy legal_holds_select_self_staff_or_service
on public.legal_holds for select to authenticated
using (public.can_manage_privacy_user(user_id, auth.uid()));

drop policy if exists legal_holds_insert_staff_or_service on public.legal_holds;
create policy legal_holds_insert_staff_or_service
on public.legal_holds for insert to authenticated
with check (public.can_staff_manage_privacy_user(user_id, auth.uid()));

drop policy if exists legal_holds_update_staff_or_service on public.legal_holds;
create policy legal_holds_update_staff_or_service
on public.legal_holds for update to authenticated
using (public.can_staff_manage_privacy_user(user_id, auth.uid()))
with check (public.can_staff_manage_privacy_user(user_id, auth.uid()));

drop policy if exists legal_holds_delete_service_only on public.legal_holds;
create policy legal_holds_delete_service_only
on public.legal_holds for delete to authenticated
using (public.is_service_role());

drop policy if exists privacy_delete_jobs_select_self_or_service on public.privacy_delete_jobs;
create policy privacy_delete_jobs_select_self_or_service
on public.privacy_delete_jobs for select to authenticated
using (user_id = auth.uid() or public.is_service_role());

drop policy if exists privacy_delete_jobs_manage_service on public.privacy_delete_jobs;
create policy privacy_delete_jobs_manage_service
on public.privacy_delete_jobs for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

revoke all on function public.has_active_legal_hold(uuid) from public;
grant execute on function public.has_active_legal_hold(uuid) to authenticated;
grant execute on function public.has_active_legal_hold(uuid) to service_role;

revoke all on function public.apply_user_anonymization(uuid, uuid) from public;
grant execute on function public.apply_user_anonymization(uuid, uuid) to service_role;

revoke all on function public.queue_privacy_delete_jobs(integer) from public;
grant execute on function public.queue_privacy_delete_jobs(integer) to service_role;

revoke all on function public.claim_privacy_delete_jobs(integer) from public;
grant execute on function public.claim_privacy_delete_jobs(integer) to service_role;

revoke all on function public.complete_privacy_delete_job(uuid, jsonb) from public;
grant execute on function public.complete_privacy_delete_job(uuid, jsonb) to service_role;

revoke all on function public.fail_privacy_delete_job(
  uuid,
  text,
  integer,
  integer,
  boolean
) from public;
grant execute on function public.fail_privacy_delete_job(
  uuid,
  text,
  integer,
  integer,
  boolean
) to service_role;
