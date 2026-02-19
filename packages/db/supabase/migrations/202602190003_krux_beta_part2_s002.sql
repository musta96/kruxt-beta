create or replace function public.join_waitlist(p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position integer;
  v_waitlist_id uuid;
  v_class_status public.class_status;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select status
  into v_class_status
  from public.gym_classes
  where id = p_class_id;

  if v_class_status is null then
    raise exception 'Class not found';
  end if;

  if v_class_status <> 'scheduled' then
    raise exception 'Class is not open for waitlist';
  end if;

  select coalesce(max(position), 0) + 1
  into v_position
  from public.class_waitlist
  where class_id = p_class_id
    and status = 'pending';

  insert into public.class_waitlist(class_id, user_id, position, status)
  values (p_class_id, auth.uid(), v_position, 'pending')
  on conflict (class_id, user_id)
  do update
    set status = 'pending',
        updated_at = now(),
        position = excluded.position
  returning id into v_waitlist_id;

  perform public.append_audit_log(
    'waitlist.joined',
    'class_waitlist',
    v_waitlist_id,
    'User joined class waitlist',
    jsonb_build_object('class_id', p_class_id)
  );

  return v_waitlist_id;
end;
$$;
