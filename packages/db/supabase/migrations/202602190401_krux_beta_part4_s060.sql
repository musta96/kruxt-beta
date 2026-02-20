revoke all on function public.submit_privacy_request(public.privacy_request_type, text) from public;
grant execute on function public.submit_privacy_request(public.privacy_request_type, text) to authenticated;
grant execute on function public.submit_privacy_request(public.privacy_request_type, text) to service_role;

revoke all on function public.transition_privacy_request_status(uuid, public.privacy_request_status, text) from public;
grant execute on function public.transition_privacy_request_status(uuid, public.privacy_request_status, text) to authenticated;
grant execute on function public.transition_privacy_request_status(uuid, public.privacy_request_status, text) to service_role;

revoke all on function public.process_privacy_request_queue(integer, integer) from public;
grant execute on function public.process_privacy_request_queue(integer, integer) to service_role;

drop function if exists public.admin_list_open_privacy_requests(uuid);

create or replace function public.admin_list_open_privacy_requests(
  p_gym_id uuid
)
returns table (
  id uuid,
  user_id uuid,
  request_type public.privacy_request_type,
  status public.privacy_request_status,
  submitted_at timestamptz,
  due_at timestamptz,
  sla_breached_at timestamptz,
  is_overdue boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_gym_staff(p_gym_id, auth.uid()) then
    raise exception 'Gym staff access is required';
  end if;

  return query
  select
    pr.id,
    pr.user_id,
    pr.request_type,
    pr.status,
    pr.submitted_at,
    pr.due_at,
    pr.sla_breached_at,
    (pr.due_at < now()) as is_overdue
  from public.privacy_requests pr
  where public.is_privacy_request_open_status(pr.status)
    and exists (
      select 1
      from public.gym_memberships gm
      where gm.gym_id = p_gym_id
        and gm.user_id = pr.user_id
    )
  order by
    (pr.sla_breached_at is not null) desc,
    pr.due_at asc nulls last,
    pr.submitted_at asc;
end;
$$;

create or replace function public.admin_get_gym_ops_summary(
  p_gym_id uuid
)
returns table (
  gym_id uuid,
  pending_memberships integer,
  active_or_trial_members integer,
  upcoming_classes integer,
  pending_waitlist_entries integer,
  open_privacy_requests integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_gym_staff(p_gym_id, auth.uid()) then
    raise exception 'Gym staff access is required';
  end if;

  return query
  select
    p_gym_id as gym_id,
    coalesce((
      select count(*)::integer
      from public.gym_memberships gm
      where gm.gym_id = p_gym_id
        and gm.membership_status = 'pending'
    ), 0) as pending_memberships,
    coalesce((
      select count(*)::integer
      from public.gym_memberships gm
      where gm.gym_id = p_gym_id
        and gm.membership_status in ('trial', 'active')
    ), 0) as active_or_trial_members,
    coalesce((
      select count(*)::integer
      from public.gym_classes gc
      where gc.gym_id = p_gym_id
        and gc.status = 'scheduled'
        and gc.starts_at >= now()
    ), 0) as upcoming_classes,
    coalesce((
      select count(*)::integer
      from public.class_waitlist cw
      join public.gym_classes gc on gc.id = cw.class_id
      where gc.gym_id = p_gym_id
        and gc.status = 'scheduled'
        and gc.starts_at >= now()
        and cw.status = 'pending'
    ), 0) as pending_waitlist_entries,
    coalesce((
      select count(*)::integer
      from public.privacy_requests pr
      where public.is_privacy_request_open_status(pr.status)
        and exists (
          select 1
          from public.gym_memberships gm
          where gm.gym_id = p_gym_id
            and gm.user_id = pr.user_id
        )
    ), 0) as open_privacy_requests;
end;
$$;

revoke all on function public.admin_list_open_privacy_requests(uuid) from public;
grant execute on function public.admin_list_open_privacy_requests(uuid) to authenticated;
grant execute on function public.admin_list_open_privacy_requests(uuid) to service_role;

revoke all on function public.admin_get_gym_ops_summary(uuid) from public;
grant execute on function public.admin_get_gym_ops_summary(uuid) to authenticated;
grant execute on function public.admin_get_gym_ops_summary(uuid) to service_role;
