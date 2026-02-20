create or replace function public.transition_privacy_request_status(
  p_request_id uuid,
  p_next_status public.privacy_request_status,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.privacy_requests%rowtype;
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_actor_is_staff boolean := false;
  v_now timestamptz := now();
  v_note text := nullif(btrim(p_notes), '');
begin
  if v_actor is null and not v_is_service then
    raise exception 'Authentication required';
  end if;

  select *
  into v_request
  from public.privacy_requests pr
  where pr.id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Privacy request not found';
  end if;

  if not v_is_service then
    select exists (
      select 1
      from public.gym_memberships gm_actor
      join public.gym_memberships gm_member
        on gm_member.gym_id = gm_actor.gym_id
       and gm_member.user_id = v_request.user_id
       and gm_member.membership_status in ('trial', 'active')
      where gm_actor.user_id = v_actor
        and gm_actor.membership_status in ('trial', 'active')
        and gm_actor.role in ('leader', 'officer', 'coach')
    )
    into v_actor_is_staff;

    if not v_actor_is_staff then
      raise exception 'Gym staff access is required';
    end if;
  end if;

  if v_request.status = p_next_status then
    return v_request.id;
  end if;

  if not (
    (v_request.status = 'submitted' and p_next_status in ('triaged', 'rejected', 'in_review'))
    or (v_request.status = 'triaged' and p_next_status in ('in_progress', 'rejected'))
    or (v_request.status = 'in_progress' and p_next_status in ('fulfilled', 'rejected'))
    or (v_request.status = 'in_review' and p_next_status in ('in_progress', 'fulfilled', 'rejected'))
    or (v_request.status = 'completed' and p_next_status = 'fulfilled')
  ) then
    raise exception 'Invalid status transition: % -> %', v_request.status, p_next_status;
  end if;

  update public.privacy_requests pr
  set
    status = p_next_status,
    triaged_at = case
      when p_next_status in ('triaged', 'in_review') then coalesce(pr.triaged_at, v_now)
      else pr.triaged_at
    end,
    in_progress_at = case
      when p_next_status = 'in_progress' then coalesce(pr.in_progress_at, v_now)
      else pr.in_progress_at
    end,
    resolved_at = case
      when p_next_status in ('fulfilled', 'completed', 'rejected') then coalesce(pr.resolved_at, v_now)
      else pr.resolved_at
    end,
    handled_by = case
      when v_actor is not null then v_actor
      else pr.handled_by
    end,
    notes = case
      when v_note is null then pr.notes
      when pr.notes is null or btrim(pr.notes) = '' then v_note
      else pr.notes || E'\n' || v_note
    end,
    updated_at = v_now
  where pr.id = v_request.id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'privacy.request_status_changed',
    'privacy_request',
    v_request.id,
    jsonb_build_object(
      'request_id', v_request.id,
      'user_id', v_request.user_id,
      'previous_status', v_request.status,
      'next_status', p_next_status,
      'handled_by', v_actor,
      'at', v_now
    )
  );

  perform public.append_audit_log(
    'privacy.request_status_changed',
    'privacy_requests',
    v_request.id,
    coalesce(v_note, 'Privacy request status transitioned'),
    jsonb_build_object(
      'previous_status', v_request.status,
      'next_status', p_next_status,
      'request_user_id', v_request.user_id,
      'service_transition', v_is_service
    )
  );

  return v_request.id;
end;
$$;

create or replace function public.process_privacy_request_queue(
  p_triage_limit integer default 25,
  p_overdue_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_triage_limit integer := greatest(1, least(coalesce(p_triage_limit, 25), 200));
  v_overdue_limit integer := greatest(1, least(coalesce(p_overdue_limit, 100), 500));
  v_triaged_ids uuid[] := '{}'::uuid[];
  v_overdue_ids uuid[] := '{}'::uuid[];
  v_item record;
  v_now timestamptz := now();
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  for v_item in
    select pr.id
    from public.privacy_requests pr
    where pr.status = 'submitted'
    order by pr.submitted_at asc
    limit v_triage_limit
    for update skip locked
  loop
    perform public.transition_privacy_request_status(
      v_item.id,
      'triaged',
      'Queued by privacy_request_processor'
    );

    v_triaged_ids := array_append(v_triaged_ids, v_item.id);
  end loop;

  for v_item in
    select pr.id, pr.user_id, pr.due_at
    from public.privacy_requests pr
    where public.is_privacy_request_open_status(pr.status)
      and pr.due_at < v_now
      and pr.sla_breached_at is null
    order by pr.due_at asc, pr.submitted_at asc
    limit v_overdue_limit
    for update skip locked
  loop
    update public.privacy_requests pr
    set
      sla_breached_at = v_now,
      updated_at = v_now
    where pr.id = v_item.id
      and pr.sla_breached_at is null;

    if found then
      v_overdue_ids := array_append(v_overdue_ids, v_item.id);

      insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
      values (
        'privacy.request_overdue',
        'privacy_request',
        v_item.id,
        jsonb_build_object(
          'request_id', v_item.id,
          'user_id', v_item.user_id,
          'due_at', v_item.due_at,
          'breached_at', v_now
        )
      );

      perform public.append_audit_log(
        'privacy.request_overdue',
        'privacy_requests',
        v_item.id,
        'Privacy request SLA breached',
        jsonb_build_object(
          'request_user_id', v_item.user_id,
          'due_at', v_item.due_at,
          'breached_at', v_now
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'triagedCount', coalesce(cardinality(v_triaged_ids), 0),
    'overdueMarkedCount', coalesce(cardinality(v_overdue_ids), 0),
    'triagedRequestIds', v_triaged_ids,
    'overdueRequestIds', v_overdue_ids
  );
end;
$$;
