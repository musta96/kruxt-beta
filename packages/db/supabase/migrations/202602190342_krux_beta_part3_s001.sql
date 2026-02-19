create or replace function public.admin_list_user_consents(
  p_gym_id uuid,
  p_user_id uuid
)
returns setof public.consents
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

  if not exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = p_gym_id
      and gm.user_id = p_user_id
  ) then
    raise exception 'Target user is not a member of this gym';
  end if;

  return query
  select c.*
  from public.consents c
  where c.user_id = p_user_id
  order by c.granted_at desc;
end;
$$;
