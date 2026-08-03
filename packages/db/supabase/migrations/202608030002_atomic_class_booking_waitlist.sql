-- Serialize class booking and waitlist mutations around the class row.
-- Member inserts must use these RPCs; direct member updates remain cancellation-only.

with ranked_pending as (
  select
    id,
    row_number() over (
      partition by class_id
      order by position, created_at, id
    )::integer as normalized_position
  from public.class_waitlist
  where status = 'pending'
)
update public.class_waitlist cw
set position = ranked_pending.normalized_position,
    updated_at = now()
from ranked_pending
where cw.id = ranked_pending.id
  and cw.position is distinct from ranked_pending.normalized_position;

create unique index if not exists uq_class_waitlist_pending_position
on public.class_waitlist(class_id, position)
where status = 'pending';

create or replace function public.enforce_class_booking_capacity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_capacity integer;
  v_booked integer;
  v_previous_id uuid;
begin
  if new.status not in ('booked', 'attended') then
    return new;
  end if;

  select gc.capacity
  into v_capacity
  from public.gym_classes gc
  where gc.id = new.class_id
  for update;

  if v_capacity is null then
    raise exception 'Class not found';
  end if;

  if tg_op = 'UPDATE' then
    v_previous_id := old.id;
  end if;

  select count(*)::integer
  into v_booked
  from public.class_bookings cb
  where cb.class_id = new.class_id
    and cb.status in ('booked', 'attended')
    and (v_previous_id is null or cb.id <> v_previous_id);

  if v_booked >= v_capacity then
    raise exception 'Class capacity reached';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_class_booking_capacity() from public, anon, authenticated, service_role;

drop trigger if exists trg_class_bookings_enforce_capacity on public.class_bookings;
create trigger trg_class_bookings_enforce_capacity
before insert or update of class_id, status on public.class_bookings
for each row execute function public.enforce_class_booking_capacity();

create or replace function public.book_gym_class(p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  v_class public.gym_classes%rowtype;
  v_booking public.class_bookings%rowtype;
  v_waitlist public.class_waitlist%rowtype;
  v_booked integer;
  v_reactivated boolean := false;
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
  if not exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = v_class.gym_id
      and gm.user_id = v_actor
      and gm.membership_status in ('trial', 'active')
  ) then
    raise exception using errcode = '42501', message = 'Active or trial gym membership required';
  end if;
  if v_class.status <> 'scheduled' or v_class.ends_at <= v_now then
    raise exception 'Class is not available for booking';
  end if;
  if v_class.booking_opens_at is null or v_class.booking_closes_at is null then
    raise exception 'Class booking window is not configured';
  end if;
  if v_now < v_class.booking_opens_at then
    raise exception 'Class booking has not opened';
  end if;
  if v_now > v_class.booking_closes_at then
    raise exception 'Class booking has closed';
  end if;

  select cb.*
  into v_booking
  from public.class_bookings cb
  where cb.class_id = p_class_id
    and cb.user_id = v_actor
  for update;

  select cw.*
  into v_waitlist
  from public.class_waitlist cw
  where cw.class_id = p_class_id
    and cw.user_id = v_actor
  for update;

  if v_booking.status = 'booked' then
    return v_booking.id;
  end if;
  if v_booking.status = 'attended' then
    raise exception 'Class attendance has already been recorded';
  end if;
  if v_booking.status = 'waitlisted' then
    raise exception 'User is already waitlisted for this class';
  end if;
  if v_booking.status = 'no_show' then
    raise exception 'A no-show booking cannot be reactivated';
  end if;
  if v_waitlist.status = 'pending' then
    raise exception 'Leave the waitlist before booking this class';
  end if;

  select count(*)::integer
  into v_booked
  from public.class_bookings cb
  where cb.class_id = p_class_id
    and cb.status in ('booked', 'attended');

  if v_booked >= v_class.capacity then
    raise exception 'Class capacity reached';
  end if;

  if v_booking.id is null then
    insert into public.class_bookings(
      class_id,
      user_id,
      status,
      booked_at,
      checked_in_at,
      source_channel
    )
    values (
      p_class_id,
      v_actor,
      'booked',
      v_now,
      null,
      'member_rpc'
    )
    returning * into v_booking;
  else
    v_reactivated := true;

    update public.class_bookings cb
    set status = 'booked',
        booked_at = v_now,
        checked_in_at = null,
        source_channel = 'member_rpc',
        updated_at = v_now
    where cb.id = v_booking.id
    returning * into v_booking;
  end if;

  perform public.append_audit_log(
    case when v_reactivated then 'class.booking.reactivated' else 'class.booking.created' end,
    'class_bookings',
    v_booking.id,
    'Member class booking',
    jsonb_build_object('classId', p_class_id, 'gymId', v_class.gym_id)
  );

  return v_booking.id;
end;
$$;

create or replace function public.join_waitlist(p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  v_class public.gym_classes%rowtype;
  v_booking public.class_bookings%rowtype;
  v_waitlist public.class_waitlist%rowtype;
  v_position integer;
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
  if not exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = v_class.gym_id
      and gm.user_id = v_actor
      and gm.membership_status in ('trial', 'active')
  ) then
    raise exception using errcode = '42501', message = 'Active or trial gym membership required';
  end if;
  if v_class.status <> 'scheduled' or v_class.ends_at <= v_now then
    raise exception 'Class is not available for waitlist';
  end if;
  if v_class.booking_opens_at is null or v_class.booking_closes_at is null then
    raise exception 'Class booking window is not configured';
  end if;
  if v_now < v_class.booking_opens_at then
    raise exception 'Class booking has not opened';
  end if;
  if v_now > v_class.booking_closes_at then
    raise exception 'Class booking has closed';
  end if;

  select cb.*
  into v_booking
  from public.class_bookings cb
  where cb.class_id = p_class_id
    and cb.user_id = v_actor
  for update;

  if v_booking.status in ('booked', 'attended') then
    raise exception 'User is already booked or attended for this class';
  end if;

  select cw.*
  into v_waitlist
  from public.class_waitlist cw
  where cw.class_id = p_class_id
    and cw.user_id = v_actor
  for update;

  if v_waitlist.status = 'pending' then
    return v_waitlist.id;
  end if;

  select coalesce(max(cw.position), 0) + 1
  into v_position
  from public.class_waitlist cw
  where cw.class_id = p_class_id
    and cw.status = 'pending';

  if v_waitlist.id is null then
    insert into public.class_waitlist(
      class_id,
      user_id,
      position,
      status,
      notified_at,
      expires_at,
      promoted_at
    )
    values (
      p_class_id,
      v_actor,
      v_position,
      'pending',
      null,
      null,
      null
    )
    returning * into v_waitlist;
  else
    update public.class_waitlist cw
    set position = v_position,
        status = 'pending',
        notified_at = null,
        expires_at = null,
        promoted_at = null,
        updated_at = v_now
    where cw.id = v_waitlist.id
    returning * into v_waitlist;
  end if;

  if v_booking.status = 'waitlisted' then
    update public.class_bookings cb
    set status = 'cancelled',
        updated_at = v_now
    where cb.id = v_booking.id;
  end if;

  perform public.append_audit_log(
    'waitlist.joined',
    'class_waitlist',
    v_waitlist.id,
    'User joined class waitlist',
    jsonb_build_object('classId', p_class_id, 'gymId', v_class.gym_id, 'position', v_position)
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
  for update;

  if v_waitlist.id is null then
    raise exception 'No pending waitlist members';
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

drop policy if exists class_bookings_insert_self_or_staff on public.class_bookings;
drop policy if exists class_bookings_insert_staff_only on public.class_bookings;
create policy class_bookings_insert_staff_only
on public.class_bookings for insert to authenticated
with check (
  exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_bookings.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
);

drop policy if exists class_bookings_update_self_or_staff on public.class_bookings;
create policy class_bookings_update_self_or_staff
on public.class_bookings for update to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_bookings.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
)
with check (
  (user_id = auth.uid() and status = 'cancelled')
  or exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_bookings.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
);

drop policy if exists class_waitlist_insert_self on public.class_waitlist;
drop policy if exists class_waitlist_insert_staff_only on public.class_waitlist;
create policy class_waitlist_insert_staff_only
on public.class_waitlist for insert to authenticated
with check (
  exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_waitlist.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
);

drop policy if exists class_waitlist_update_self_or_staff on public.class_waitlist;
create policy class_waitlist_update_self_or_staff
on public.class_waitlist for update to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_waitlist.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
)
with check (
  (user_id = auth.uid() and status = 'cancelled')
  or exists (
    select 1
    from public.gym_classes gc
    where gc.id = class_waitlist.class_id
      and public.is_gym_staff(gc.gym_id, auth.uid())
  )
);

revoke all on function public.book_gym_class(uuid) from public, anon, service_role;
grant execute on function public.book_gym_class(uuid) to authenticated;

revoke all on function public.join_waitlist(uuid) from public, anon, service_role;
grant execute on function public.join_waitlist(uuid) to authenticated;

revoke all on function public.promote_waitlist_member(uuid) from public, anon, service_role;
grant execute on function public.promote_waitlist_member(uuid) to authenticated;
