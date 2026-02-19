create or replace function public.promote_waitlist_member(p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_id uuid;
  v_capacity integer;
  v_booked integer;
  v_waitlist_row public.class_waitlist%rowtype;
  v_booking_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select gym_id, capacity
  into v_gym_id, v_capacity
  from public.gym_classes
  where id = p_class_id;

  if v_gym_id is null then
    raise exception 'Class not found';
  end if;

  if not public.is_gym_staff(v_gym_id, auth.uid()) then
    raise exception 'Only gym staff can promote waitlist members';
  end if;

  select count(*)::integer
  into v_booked
  from public.class_bookings cb
  where cb.class_id = p_class_id
    and cb.status in ('booked', 'attended');

  if v_booked >= v_capacity then
    raise exception 'Class is still full';
  end if;

  select *
  into v_waitlist_row
  from public.class_waitlist cw
  where cw.class_id = p_class_id
    and cw.status = 'pending'
  order by cw.position asc
  limit 1
  for update skip locked;

  if v_waitlist_row.id is null then
    raise exception 'No pending waitlist members';
  end if;

  insert into public.class_bookings(class_id, user_id, status, source_channel)
  values (p_class_id, v_waitlist_row.user_id, 'booked', 'waitlist_promotion')
  on conflict (class_id, user_id)
  do update
    set status = 'booked',
        updated_at = now(),
        source_channel = 'waitlist_promotion'
  returning id into v_booking_id;

  update public.class_waitlist
  set status = 'promoted',
      promoted_at = now(),
      updated_at = now()
  where id = v_waitlist_row.id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'class.waitlist_promoted',
    'class',
    p_class_id,
    jsonb_build_object('booking_id', v_booking_id, 'user_id', v_waitlist_row.user_id)
  );

  perform public.append_audit_log(
    'waitlist.promoted',
    'class_waitlist',
    v_waitlist_row.id,
    'Staff promoted waitlist user',
    jsonb_build_object('class_id', p_class_id, 'booking_id', v_booking_id)
  );

  return v_booking_id;
end;
$$;
