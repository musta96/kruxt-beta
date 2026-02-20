create or replace function public.build_privacy_export_payload(
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_target_user uuid := coalesce(p_user_id, v_actor);
begin
  if v_target_user is null then
    raise exception 'Authentication required';
  end if;

  if not v_is_service and v_actor is distinct from v_target_user then
    raise exception 'Cannot export data for another user';
  end if;

  return jsonb_build_object(
    'schema_version', '2026-02',
    'generated_at', now(),
    'user_id', v_target_user,
    'profile', coalesce((
      select to_jsonb(p)
      from (
        select
          pr.id,
          pr.username,
          pr.display_name,
          pr.avatar_url,
          pr.bio,
          pr.home_gym_id,
          pr.is_public,
          pr.xp_total,
          pr.level,
          pr.rank_tier,
          pr.chain_days,
          pr.last_workout_at,
          pr.locale,
          pr.preferred_units,
          pr.created_at,
          pr.updated_at
        from public.profiles pr
        where pr.id = v_target_user
      ) p
    ), '{}'::jsonb),
    'gym_memberships', coalesce((
      select jsonb_agg(to_jsonb(gm) order by gm.created_at asc)
      from (
        select
          m.id,
          m.gym_id,
          m.role,
          m.membership_status,
          m.membership_plan_id,
          m.started_at,
          m.ends_at,
          m.created_at,
          m.updated_at
        from public.gym_memberships m
        where m.user_id = v_target_user
      ) gm
    ), '[]'::jsonb),
    'workouts', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.started_at desc, w.created_at desc)
      from (
        select
          w.id,
          w.gym_id,
          w.title,
          w.workout_type,
          w.notes,
          w.started_at,
          w.ended_at,
          w.rpe,
          w.visibility,
          w.total_sets,
          w.total_volume_kg,
          w.is_pr,
          w.source,
          w.external_activity_id,
          w.created_at,
          w.updated_at
        from public.workouts w
        where w.user_id = v_target_user
      ) w
    ), '[]'::jsonb),
    'workout_exercises', coalesce((
      select jsonb_agg(to_jsonb(we) order by we.created_at asc)
      from (
        select
          e.id,
          e.workout_id,
          e.exercise_id,
          e.order_index,
          e.block_id,
          e.block_type,
          e.target_reps,
          e.target_weight_kg,
          e.notes,
          e.created_at,
          e.updated_at
        from public.workout_exercises e
        where exists (
          select 1
          from public.workouts w
          where w.id = e.workout_id
            and w.user_id = v_target_user
        )
      ) we
    ), '[]'::jsonb),
    'workout_sets', coalesce((
      select jsonb_agg(to_jsonb(ws) order by ws.created_at asc)
      from (
        select
          s.id,
          s.workout_exercise_id,
          s.set_index,
          s.reps,
          s.weight_kg,
          s.duration_seconds,
          s.distance_m,
          s.rpe,
          s.is_pr,
          s.created_at,
          s.updated_at
        from public.workout_sets s
        where exists (
          select 1
          from public.workout_exercises e
          join public.workouts w on w.id = e.workout_id
          where e.id = s.workout_exercise_id
            and w.user_id = v_target_user
        )
      ) ws
    ), '[]'::jsonb),
    'social_connections', coalesce((
      select jsonb_agg(to_jsonb(sc) order by sc.created_at asc)
      from (
        select
          c.id,
          c.follower_user_id,
          c.followed_user_id,
          c.status,
          c.created_at,
          c.updated_at
        from public.social_connections c
        where c.follower_user_id = v_target_user
           or c.followed_user_id = v_target_user
      ) sc
    ), '[]'::jsonb),
    'social_interactions', coalesce((
      select jsonb_agg(to_jsonb(si) order by si.created_at asc)
      from (
        select
          i.id,
          i.workout_id,
          i.actor_user_id,
          i.interaction_type,
          i.reaction_type,
          i.comment_text,
          i.parent_interaction_id,
          i.created_at,
          i.updated_at
        from public.social_interactions i
        where i.actor_user_id = v_target_user
      ) si
    ), '[]'::jsonb),
    'class_bookings', coalesce((
      select jsonb_agg(to_jsonb(cb) order by cb.booked_at desc)
      from (
        select
          b.id,
          b.class_id,
          b.status,
          b.booked_at,
          b.checked_in_at,
          b.source_channel,
          b.updated_at
        from public.class_bookings b
        where b.user_id = v_target_user
      ) cb
    ), '[]'::jsonb),
    'class_waitlist', coalesce((
      select jsonb_agg(to_jsonb(cw) order by cw.created_at desc)
      from (
        select
          w.id,
          w.class_id,
          w.position,
          w.status,
          w.notified_at,
          w.expires_at,
          w.promoted_at,
          w.created_at,
          w.updated_at
        from public.class_waitlist w
        where w.user_id = v_target_user
      ) cw
    ), '[]'::jsonb),
    'gym_checkins', coalesce((
      select jsonb_agg(to_jsonb(gc) order by gc.checked_in_at desc)
      from (
        select
          c.id,
          c.gym_id,
          c.class_id,
          c.checked_in_at,
          c.source_channel,
          c.metadata,
          c.created_at
        from public.gym_checkins c
        where c.user_id = v_target_user
      ) gc
    ), '[]'::jsonb),
    'access_logs', coalesce((
      select jsonb_agg(to_jsonb(al) order by al.created_at desc)
      from (
        select
          l.id,
          l.gym_id,
          l.event_type,
          l.result,
          l.reason,
          l.metadata,
          l.created_at
        from public.access_logs l
        where l.user_id = v_target_user
      ) al
    ), '[]'::jsonb),
    'notification_preferences', coalesce((
      select to_jsonb(np)
      from (
        select
          n.id,
          n.push_enabled,
          n.email_enabled,
          n.in_app_enabled,
          n.marketing_enabled,
          n.workout_reactions_enabled,
          n.comments_enabled,
          n.challenge_updates_enabled,
          n.class_reminders_enabled,
          n.quiet_hours_start,
          n.quiet_hours_end,
          n.timezone,
          n.created_at,
          n.updated_at
        from public.notification_preferences n
        where n.user_id = v_target_user
      ) np
    ), '{}'::jsonb),
    'push_notification_tokens', coalesce((
      select jsonb_agg(to_jsonb(pt) order by pt.created_at asc)
      from (
        select
          t.id,
          t.device_id,
          t.platform,
          t.is_active,
          t.last_seen_at,
          t.created_at,
          t.updated_at
        from public.push_notification_tokens t
        where t.user_id = v_target_user
      ) pt
    ), '[]'::jsonb),
    'device_connections', coalesce((
      select jsonb_agg(to_jsonb(dc) order by dc.created_at asc)
      from (
        select
          c.id,
          c.provider,
          c.status,
          c.provider_user_id,
          c.scopes,
          c.token_expires_at,
          c.last_synced_at,
          c.last_error,
          c.metadata,
          c.created_at,
          c.updated_at
        from public.device_connections c
        where c.user_id = v_target_user
      ) dc
    ), '[]'::jsonb),
    'external_activity_imports', coalesce((
      select jsonb_agg(to_jsonb(ea) order by ea.imported_at desc)
      from (
        select
          e.id,
          e.connection_id,
          e.provider,
          e.external_activity_id,
          e.activity_type,
          e.started_at,
          e.ended_at,
          e.duration_seconds,
          e.distance_m,
          e.calories,
          e.average_hr,
          e.max_hr,
          e.raw_data,
          e.mapped_workout_id,
          e.imported_at,
          e.created_at
        from public.external_activity_imports e
        where e.user_id = v_target_user
      ) ea
    ), '[]'::jsonb),
    'consents', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.granted_at desc, c.created_at desc)
      from (
        select
          c.id,
          c.consent_type,
          c.policy_version_id,
          c.granted,
          c.granted_at,
          c.revoked_at,
          c.source,
          c.locale,
          c.evidence,
          c.created_at
        from public.consents c
        where c.user_id = v_target_user
      ) c
    ), '[]'::jsonb),
    'privacy_requests', coalesce((
      select jsonb_agg(to_jsonb(pr) order by pr.submitted_at desc)
      from (
        select
          r.id,
          r.request_type,
          r.status,
          r.reason,
          r.submitted_at,
          r.due_at,
          r.triaged_at,
          r.in_progress_at,
          r.resolved_at,
          r.response_location,
          r.response_expires_at,
          r.response_content_type,
          r.response_bytes,
          r.sla_breached_at,
          r.notes,
          r.created_at,
          r.updated_at
        from public.privacy_requests r
        where r.user_id = v_target_user
      ) pr
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.queue_privacy_export_jobs(
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
    where pr.request_type in ('access', 'export')
      and pr.status in ('submitted', 'triaged', 'in_progress', 'in_review')
      and pr.resolved_at is null
      and not exists (
        select 1
        from public.privacy_export_jobs j
        where j.privacy_request_id = pr.id
          and j.status in ('queued', 'running', 'retry_scheduled', 'succeeded')
      )
    order by pr.submitted_at asc
    limit v_limit
  )
  insert into public.privacy_export_jobs(
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

create or replace function public.claim_privacy_export_jobs(
  p_limit integer default 5
)
returns setof public.privacy_export_jobs
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
    from public.privacy_export_jobs j
    join public.privacy_requests pr
      on pr.id = j.privacy_request_id
    where j.status in ('queued', 'retry_scheduled')
      and coalesce(j.next_retry_at, j.created_at) <= now()
      and pr.request_type in ('access', 'export')
      and public.is_privacy_request_open_status(pr.status)
    order by coalesce(j.next_retry_at, j.created_at) asc
    limit v_limit
    for update of j skip locked
  ),
  updated as (
    update public.privacy_export_jobs j
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

create or replace function public.complete_privacy_export_job(
  p_job_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_signed_url text,
  p_signed_url_expires_at timestamptz,
  p_file_bytes bigint default null,
  p_record_count integer default null,
  p_content_type text default 'application/json'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.privacy_export_jobs%rowtype;
  v_request public.privacy_requests%rowtype;
  v_bucket text := nullif(btrim(p_storage_bucket), '');
  v_path text := nullif(btrim(p_storage_path), '');
  v_signed_url text := nullif(btrim(p_signed_url), '');
  v_content_type text := coalesce(nullif(btrim(p_content_type), ''), 'application/json');
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  select *
  into v_job
  from public.privacy_export_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'Privacy export job not found';
  end if;

  if v_job.status <> 'running' then
    raise exception 'Privacy export job must be running before completion';
  end if;

  if v_bucket is null or v_path is null or v_signed_url is null then
    raise exception 'Storage bucket, path, and signed URL are required';
  end if;

  select *
  into v_request
  from public.privacy_requests pr
  where pr.id = v_job.privacy_request_id
  for update;

  if v_request.id is null then
    raise exception 'Privacy request not found for export job';
  end if;

  if v_request.status = 'submitted' then
    perform public.transition_privacy_request_status(
      v_request.id,
      'triaged',
      'Export queue promoted request'
    );
    v_request.status := 'triaged';
  end if;

  if v_request.status = 'triaged' then
    perform public.transition_privacy_request_status(
      v_request.id,
      'in_progress',
      'Export generation started'
    );
    v_request.status := 'in_progress';
  end if;

  if v_request.status in ('in_progress', 'in_review') then
    perform public.transition_privacy_request_status(
      v_request.id,
      'fulfilled',
      'Export package generated'
    );
  elsif v_request.status = 'rejected' then
    raise exception 'Cannot complete export for rejected privacy request';
  end if;

  update public.privacy_export_jobs j
  set
    status = 'succeeded',
    storage_bucket = v_bucket,
    storage_path = v_path,
    signed_url = v_signed_url,
    signed_url_expires_at = p_signed_url_expires_at,
    file_bytes = p_file_bytes,
    record_count = p_record_count,
    finished_at = now(),
    next_retry_at = null,
    error_message = null,
    updated_at = now()
  where j.id = v_job.id;

  update public.privacy_requests pr
  set
    response_location = v_signed_url,
    response_expires_at = p_signed_url_expires_at,
    response_content_type = v_content_type,
    response_bytes = p_file_bytes,
    updated_at = now()
  where pr.id = v_request.id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'privacy.export_ready',
    'privacy_request',
    v_request.id,
    jsonb_build_object(
      'request_id', v_request.id,
      'job_id', v_job.id,
      'user_id', v_job.user_id,
      'bucket', v_bucket,
      'path', v_path,
      'signed_url_expires_at', p_signed_url_expires_at,
      'file_bytes', p_file_bytes,
      'record_count', p_record_count
    )
  );

  perform public.append_audit_log(
    'privacy.export_ready',
    'privacy_export_jobs',
    v_job.id,
    'Privacy export package generated',
    jsonb_build_object(
      'request_id', v_request.id,
      'user_id', v_job.user_id,
      'bucket', v_bucket,
      'path', v_path,
      'signed_url_expires_at', p_signed_url_expires_at,
      'file_bytes', p_file_bytes,
      'record_count', p_record_count
    )
  );

  return v_request.id;
end;
$$;

create or replace function public.fail_privacy_export_job(
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
  v_job public.privacy_export_jobs%rowtype;
  v_request public.privacy_requests%rowtype;
  v_error text := coalesce(nullif(btrim(p_error), ''), 'Unknown export processing error');
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
  from public.privacy_export_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'Privacy export job not found';
  end if;

  v_retry_count := coalesce(v_job.retry_count, 0) + 1;
  v_final_failure := v_retry_count >= v_max_retries;

  if v_final_failure then
    update public.privacy_export_jobs j
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
          'Export queue promoted request'
        );
        v_request.status := 'triaged';
      end if;

      if v_request.status = 'triaged' then
        perform public.transition_privacy_request_status(
          v_request.id,
          'in_progress',
          'Export generation started'
        );
        v_request.status := 'in_progress';
      end if;

      if v_request.status in ('in_progress', 'in_review') then
        perform public.transition_privacy_request_status(
          v_request.id,
          'rejected',
          'Export generation failed after max retries'
        );
      end if;
    end if;

    insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
    values (
      'privacy.export_failed',
      'privacy_request',
      v_job.privacy_request_id,
      jsonb_build_object(
        'request_id', v_job.privacy_request_id,
        'job_id', v_job.id,
        'user_id', v_job.user_id,
        'retry_count', v_retry_count,
        'max_retries', v_max_retries,
        'error', v_error
      )
    );

    perform public.append_audit_log(
      'privacy.export_failed',
      'privacy_export_jobs',
      v_job.id,
      'Privacy export failed after max retries',
      jsonb_build_object(
        'request_id', v_job.privacy_request_id,
        'user_id', v_job.user_id,
        'retry_count', v_retry_count,
        'max_retries', v_max_retries,
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

  update public.privacy_export_jobs j
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
