create or replace function public.cancel_gym_class_booking(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  v_booking public.class_bookings%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select cb.*
  into v_booking
  from public.class_bookings cb
  where cb.id = p_booking_id
    and cb.user_id = v_actor
  for update;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.status = 'cancelled' then
    return v_booking.id;
  end if;
  if v_booking.status not in ('booked', 'waitlisted') then
    raise exception 'Only booked or waitlisted bookings can be cancelled';
  end if;

  update public.class_bookings cb
  set status = 'cancelled',
      updated_at = v_now
  where cb.id = v_booking.id;

  perform public.append_audit_log(
    'class.booking.cancelled',
    'class_bookings',
    v_booking.id,
    'Member cancelled class booking',
    jsonb_build_object('classId', v_booking.class_id)
  );

  return v_booking.id;
end;
$$;

create or replace function public.leave_class_waitlist(p_waitlist_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  v_waitlist public.class_waitlist%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select cw.*
  into v_waitlist
  from public.class_waitlist cw
  where cw.id = p_waitlist_id
    and cw.user_id = v_actor
  for update;

  if v_waitlist.id is null then
    raise exception 'Waitlist entry not found';
  end if;
  if v_waitlist.status = 'cancelled' then
    return v_waitlist.id;
  end if;
  if v_waitlist.status <> 'pending' then
    raise exception 'Only pending waitlist entries can be left';
  end if;

  update public.class_waitlist cw
  set status = 'cancelled',
      updated_at = v_now
  where cw.id = v_waitlist.id;

  perform public.append_audit_log(
    'waitlist.left',
    'class_waitlist',
    v_waitlist.id,
    'Member left class waitlist',
    jsonb_build_object('classId', v_waitlist.class_id, 'position', v_waitlist.position)
  );

  return v_waitlist.id;
end;
$$;

create or replace function public.promote_waitlist_member(p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  v_class public.gym_classes%rowtype;
  v_booked integer;
  v_waitlist public.class_waitlist%rowtype;
  v_booking_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select gc.*
  into v_class
  from public.gym_classes gc
  where gc.id = p_class_id
  for update;

  if v_class.id is null then
    raise exception 'Class not found';
  end if;
  if not public.is_gym_staff(v_class.gym_id, v_actor) then
    raise exception using errcode = '42501', message = 'Only gym staff can promote waitlist members';
  end if;
  if v_class.status <> 'scheduled' then
    raise exception 'Class is not scheduled';
  end if;
  if v_class.ends_at <= v_now then
    raise exception 'Class has ended';
  end if;
  if v_class.starts_at <= v_now then
    raise exception 'Class has already started';
  end if;

  select count(*)::integer
  into v_booked
  from public.class_bookings cb
  where cb.class_id = p_class_id
    and cb.status in ('booked', 'attended');

  if v_booked >= v_class.capacity then
    raise exception 'Class is still full';
  end if;

  select cw.*
  into v_waitlist
  from public.class_waitlist cw
  join public.gym_memberships gm
    on gm.gym_id = v_class.gym_id
   and gm.user_id = cw.user_id
   and gm.membership_status in ('trial', 'active')
  where cw.class_id = p_class_id
    and cw.status = 'pending'
    and not exists (
      select 1
      from public.class_bookings cb
      where cb.class_id = cw.class_id
        and cb.user_id = cw.user_id
        and cb.status in ('booked', 'attended')
    )
  order by cw.position, cw.created_at, cw.id
  limit 1
  for update of cw, gm;

  if v_waitlist.id is null then
    raise exception 'No eligible pending waitlist members';
  end if;

  insert into public.class_bookings(class_id, user_id, status, booked_at, source_channel)
  values (p_class_id, v_waitlist.user_id, 'booked', v_now, 'waitlist_promotion')
  on conflict (class_id, user_id)
  do update
    set status = 'booked',
        booked_at = v_now,
        checked_in_at = null,
        updated_at = v_now,
        source_channel = 'waitlist_promotion'
  returning id into v_booking_id;

  update public.class_waitlist cw
  set status = 'promoted',
      promoted_at = v_now,
      updated_at = v_now
  where cw.id = v_waitlist.id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'class.waitlist_promoted',
    'class',
    p_class_id,
    jsonb_build_object('booking_id', v_booking_id, 'user_id', v_waitlist.user_id)
  );

  perform public.append_audit_log(
    'waitlist.promoted',
    'class_waitlist',
    v_waitlist.id,
    'Staff promoted waitlist user',
    jsonb_build_object('classId', p_class_id, 'bookingId', v_booking_id)
  );

  return v_booking_id;
end;
$$;

comment on function public.promote_waitlist_member(uuid) is
  'Staff promotion ignores booking_closes_at so late vacancies can be filled, but requires a scheduled class before starts_at and an active/trial membership.';

drop policy if exists class_bookings_update_self_or_staff on public.class_bookings;
drop policy if exists class_bookings_update_staff_only on public.class_bookings;
create policy class_bookings_update_staff_only
on public.class_bookings for update to authenticated
using (
  exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_bookings.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_bookings.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
);

drop policy if exists class_waitlist_update_self_or_staff on public.class_waitlist;
drop policy if exists class_waitlist_update_staff_only on public.class_waitlist;
create policy class_waitlist_update_staff_only
on public.class_waitlist for update to authenticated
using (
  exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_waitlist.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_waitlist.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
);

revoke all on function public.cancel_gym_class_booking(uuid) from public, anon, service_role;
grant execute on function public.cancel_gym_class_booking(uuid) to authenticated;

revoke all on function public.leave_class_waitlist(uuid) from public, anon, service_role;
grant execute on function public.leave_class_waitlist(uuid) to authenticated;

revoke all on function public.promote_waitlist_member(uuid) from public, anon, service_role;
grant execute on function public.promote_waitlist_member(uuid) to authenticated;
