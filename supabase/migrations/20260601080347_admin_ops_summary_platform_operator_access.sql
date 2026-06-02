-- Let KRUXT platform operators load gym admin overview summaries while
-- preserving the existing gym-staff gate for normal gym users.

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
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_gym_staff(p_gym_id, v_actor)
    or public.platform_operator_has_permission('platform.gyms.manage', v_actor)
    or public.platform_operator_has_permission('platform.tenants.impersonate', v_actor)
  ) then
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

revoke all on function public.admin_get_gym_ops_summary(uuid) from public;
grant execute on function public.admin_get_gym_ops_summary(uuid) to authenticated;
grant execute on function public.admin_get_gym_ops_summary(uuid) to service_role;
