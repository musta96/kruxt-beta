create or replace function public.admin_list_open_privacy_requests(
  p_gym_id uuid
)
returns table (
  id uuid,
  user_id uuid,
  request_type public.privacy_request_type,
  status public.privacy_request_status,
  submitted_at timestamptz,
  due_at timestamptz
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
    pr.due_at
  from public.privacy_requests pr
  where pr.status in ('submitted', 'in_review')
    and exists (
      select 1
      from public.gym_memberships gm
      where gm.gym_id = p_gym_id
        and gm.user_id = pr.user_id
    )
  order by pr.submitted_at asc;
end;
$$;
