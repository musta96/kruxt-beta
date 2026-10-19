-- Bound lock acquisition during selective repairs and short DDL operations.
set lock_timeout = '5s';

-- Keep scheduled classes bookable even when older admin clients omit windows.
update public.gym_classes gc
set booking_closes_at = least(coalesce(gc.booking_closes_at, gc.starts_at), gc.starts_at)
where gc.status = 'scheduled'
  and (
    gc.booking_closes_at is null
    or gc.booking_closes_at > gc.starts_at
  );

update public.gym_classes gc
set booking_opens_at = least(coalesce(gc.booking_opens_at, now()), gc.booking_closes_at)
where gc.status = 'scheduled'
  and (
    gc.booking_opens_at is null
    or gc.booking_opens_at > gc.booking_closes_at
  );

alter table public.gym_classes
drop constraint if exists gym_classes_scheduled_booking_window_check;

alter table public.gym_classes
add constraint gym_classes_scheduled_booking_window_check
check (
  status <> 'scheduled'
  or (
    booking_opens_at is not null
    and booking_closes_at is not null
    and booking_opens_at <= booking_closes_at
    and booking_closes_at <= starts_at
  )
) not valid;

-- Validate separately after rollout; NOT VALID still enforces all new writes
-- and avoids a table scan while the migration holds its DDL locks.

create or replace function public.enforce_gym_class_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_active_bookings integer;
begin
  if new.status = 'scheduled' then
    if new.booking_closes_at is null then
      new.booking_closes_at := new.starts_at;
    end if;
    if new.booking_opens_at is null then
      new.booking_opens_at := least(now(), new.booking_closes_at);
    end if;
    if new.booking_opens_at > new.booking_closes_at then
      raise exception 'Class booking open time must not be after booking close time';
    end if;
    if new.booking_closes_at > new.starts_at then
      raise exception 'Class booking close time must not be after class start';
    end if;
  end if;

  if new.status = 'completed' and new.ends_at > clock_timestamp() then
    raise exception 'Class cannot be completed before it ends';
  end if;

  if tg_op = 'UPDATE' then
    if old.status in ('cancelled', 'completed') and new.status <> old.status then
      raise exception 'Terminal classes cannot change status';
    end if;
    if new.capacity < old.capacity then
      select count(*)::integer
      into v_active_bookings
      from public.class_bookings cb
      where cb.class_id = new.id
        and cb.status in ('booked', 'attended');

      if new.capacity < v_active_bookings then
        raise exception 'Class capacity cannot be lower than active bookings';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_gym_class_lifecycle() from public, anon, authenticated, service_role;

drop trigger if exists trg_gym_classes_enforce_lifecycle on public.gym_classes;
create trigger trg_gym_classes_enforce_lifecycle
before insert or update of capacity, status, starts_at, ends_at, booking_opens_at, booking_closes_at
on public.gym_classes
for each row execute function public.enforce_gym_class_lifecycle();

drop trigger if exists trg_gym_classes_cascade_cancellation on public.gym_classes;
drop trigger if exists trg_gym_classes_cascade_terminal_state on public.gym_classes;
drop function if exists public.cascade_cancelled_class_state();

create or replace function public.cascade_terminal_class_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_primary_bookings integer;
  v_legacy_waitlist_bookings integer;
  v_waitlist_entries integer;
begin
  if new.status not in ('cancelled', 'completed') then
    return new;
  end if;

  if new.status = 'cancelled' then
    update public.class_bookings cb
    set status = 'cancelled',
        updated_at = now()
    where cb.class_id = new.id
      and cb.status = 'booked';
    get diagnostics v_primary_bookings = row_count;

    update public.class_bookings cb
    set status = 'cancelled',
        updated_at = now()
    where cb.class_id = new.id
      and cb.status = 'waitlisted';
    get diagnostics v_legacy_waitlist_bookings = row_count;

    update public.class_waitlist cw
    set status = 'cancelled',
        updated_at = now()
    where cw.class_id = new.id
      and cw.status = 'pending';
    get diagnostics v_waitlist_entries = row_count;

    if old.status is distinct from new.status
      or v_primary_bookings > 0
      or v_legacy_waitlist_bookings > 0
      or v_waitlist_entries > 0 then
      insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
      values (
        'class.cancelled',
        'class',
        new.id,
        jsonb_build_object(
          'gym_id', new.gym_id,
          'cancelled_bookings', v_primary_bookings + v_legacy_waitlist_bookings,
          'cancelled_waitlist_entries', v_waitlist_entries
        )
      );

      perform public.append_audit_log(
        'class.cancelled',
        'gym_classes',
        new.id,
        'Staff cancelled class',
        jsonb_build_object(
          'gymId', new.gym_id,
          'previousStatus', old.status,
          'cancelledBookings', v_primary_bookings + v_legacy_waitlist_bookings,
          'cancelledWaitlistEntries', v_waitlist_entries
        )
      );
    end if;
  else
    update public.class_bookings cb
    set status = 'no_show',
        updated_at = now()
    where cb.class_id = new.id
      and cb.status = 'booked';
    get diagnostics v_primary_bookings = row_count;

    update public.class_bookings cb
    set status = 'cancelled',
        updated_at = now()
    where cb.class_id = new.id
      and cb.status = 'waitlisted';
    get diagnostics v_legacy_waitlist_bookings = row_count;

    update public.class_waitlist cw
    set status = 'expired',
        expires_at = coalesce(cw.expires_at, now()),
        updated_at = now()
    where cw.class_id = new.id
      and cw.status = 'pending';
    get diagnostics v_waitlist_entries = row_count;

    if old.status is distinct from new.status
      or v_primary_bookings > 0
      or v_legacy_waitlist_bookings > 0
      or v_waitlist_entries > 0 then
      insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
      values (
        'class.completed',
        'class',
        new.id,
        jsonb_build_object(
          'gym_id', new.gym_id,
          'no_show_bookings', v_primary_bookings,
          'cancelled_legacy_waitlist_bookings', v_legacy_waitlist_bookings,
          'expired_waitlist_entries', v_waitlist_entries
        )
      );

      perform public.append_audit_log(
        'class.completed',
        'gym_classes',
        new.id,
        'Staff completed class',
        jsonb_build_object(
          'gymId', new.gym_id,
          'previousStatus', old.status,
          'noShowBookings', v_primary_bookings,
          'cancelledLegacyWaitlistBookings', v_legacy_waitlist_bookings,
          'expiredWaitlistEntries', v_waitlist_entries
        )
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.cascade_terminal_class_state() from public, anon, authenticated, service_role;

create trigger trg_gym_classes_cascade_terminal_state
after update of status on public.gym_classes
for each row execute function public.cascade_terminal_class_state();

create or replace function public.cancel_gym_class(p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.update_gym_class_by_staff(p_class_id, '{"status":"cancelled"}'::jsonb);
  return p_class_id;
end;
$$;

create or replace function public.expire_ineligible_class_waitlist(
  p_class_id uuid,
  p_gym_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_expired integer;
begin
  update public.class_waitlist cw
  set status = 'expired',
      expires_at = coalesce(cw.expires_at, now()),
      updated_at = now()
  where cw.class_id = p_class_id
    and cw.status = 'pending'
    and (
      not exists (
        select 1
        from public.gym_memberships gm
        where gm.gym_id = p_gym_id
          and gm.user_id = cw.user_id
          and gm.membership_status in ('trial', 'active')
      )
      or exists (
        select 1
        from public.class_bookings cb
        where cb.class_id = cw.class_id
          and cb.user_id = cw.user_id
          and cb.status in ('booked', 'attended')
      )
    );
  get diagnostics v_expired = row_count;

  if v_expired > 0 then
    perform public.append_audit_log(
      'waitlist.ineligible_expired',
      'gym_classes',
      p_class_id,
      'Expired ineligible class waitlist entries',
      jsonb_build_object('gymId', p_gym_id, 'expiredEntries', v_expired)
    );
  end if;

  return v_expired;
end;
$$;

revoke all on function public.expire_ineligible_class_waitlist(uuid, uuid)
from public, anon, authenticated, service_role;

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
  v_membership public.gym_memberships%rowtype;
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

  select gm.*
  into v_membership
  from public.gym_memberships gm
  where gm.gym_id = v_class.gym_id
    and gm.user_id = v_actor
  for update;

  if v_membership.id is null or v_membership.membership_status not in ('trial', 'active') then
    raise exception using errcode = '42501', message = 'Active or trial gym membership required';
  end if;
  v_now := clock_timestamp();
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

  perform public.expire_ineligible_class_waitlist(p_class_id, v_class.gym_id);

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

  if exists (
    select 1
    from public.class_waitlist cw
    where cw.class_id = p_class_id
      and cw.status = 'pending'
  ) then
    raise exception 'Class has a pending waitlist; promote queued members first';
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
  v_membership public.gym_memberships%rowtype;
  v_booking public.class_bookings%rowtype;
  v_waitlist public.class_waitlist%rowtype;
  v_booked integer;
  v_has_queue boolean;
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

  select gm.*
  into v_membership
  from public.gym_memberships gm
  where gm.gym_id = v_class.gym_id
    and gm.user_id = v_actor
  for update;

  if v_membership.id is null or v_membership.membership_status not in ('trial', 'active') then
    raise exception using errcode = '42501', message = 'Active or trial gym membership required';
  end if;
  v_now := clock_timestamp();
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

  perform public.expire_ineligible_class_waitlist(p_class_id, v_class.gym_id);

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

  select count(*)::integer
  into v_booked
  from public.class_bookings cb
  where cb.class_id = p_class_id
    and cb.status in ('booked', 'attended');

  select exists (
    select 1
    from public.class_waitlist cw
    where cw.class_id = p_class_id
      and cw.status = 'pending'
  )
  into v_has_queue;

  if v_booked < v_class.capacity and not v_has_queue then
    raise exception 'Class has available capacity; book it directly';
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
  if v_class.ends_at <= v_now then
    raise exception 'Class has ended';
  end if;
  if v_class.starts_at <= v_now then
    raise exception 'Class has already started';
  end if;

  perform public.expire_ineligible_class_waitlist(p_class_id, v_class.gym_id);

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
  v_now := clock_timestamp();
  if v_class.starts_at <= v_now then
    raise exception 'Class has already started';
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
  'Staff promotion ignores booking_closes_at, expires ineligible queue entries, and requires a scheduled class before starts_at.';

create or replace function public.cancel_gym_class_booking(p_booking_id uuid)
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
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select gc.*
  into v_class
  from public.class_bookings cb
  join public.gym_classes gc on gc.id = cb.class_id
  where cb.id = p_booking_id
    and cb.user_id = v_actor
  for update of gc;

  if v_class.id is null then
    raise exception 'Booking not found';
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

  select cb.*
  into v_booking
  from public.class_bookings cb
  where cb.id = p_booking_id
    and cb.user_id = v_actor
    and cb.class_id = v_class.id
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
  v_class public.gym_classes%rowtype;
  v_waitlist public.class_waitlist%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select gc.*
  into v_class
  from public.class_waitlist cw
  join public.gym_classes gc on gc.id = cw.class_id
  where cw.id = p_waitlist_id
    and cw.user_id = v_actor
  for update of gc;

  if v_class.id is null then
    raise exception 'Waitlist entry not found';
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

  select cw.*
  into v_waitlist
  from public.class_waitlist cw
  where cw.id = p_waitlist_id
    and cw.user_id = v_actor
    and cw.class_id = v_class.id
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

comment on function public.cancel_gym_class_booking(uuid) is
  'Members may cancel after booking_closes_at, but only while the class is scheduled and before starts_at.';

comment on function public.leave_class_waitlist(uuid) is
  'Members may leave after booking_closes_at, but only while the class is scheduled and before starts_at.';

revoke all on function public.cancel_gym_class(uuid) from public, anon, service_role;
grant execute on function public.cancel_gym_class(uuid) to authenticated;

revoke all on function public.book_gym_class(uuid) from public, anon, service_role;
grant execute on function public.book_gym_class(uuid) to authenticated;

revoke all on function public.join_waitlist(uuid) from public, anon, service_role;
grant execute on function public.join_waitlist(uuid) to authenticated;

revoke all on function public.promote_waitlist_member(uuid) from public, anon, service_role;
grant execute on function public.promote_waitlist_member(uuid) to authenticated;

revoke all on function public.cancel_gym_class_booking(uuid) from public, anon, service_role;
grant execute on function public.cancel_gym_class_booking(uuid) to authenticated;

revoke all on function public.leave_class_waitlist(uuid) from public, anon, service_role;
grant execute on function public.leave_class_waitlist(uuid) to authenticated;

-- Internal authorization helper: every staff mutation takes the parent lock
-- before membership or child locks, including mutations that only change status.
create or replace function public.lock_staff_class(p_class_id uuid)
returns public.gym_classes
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_class public.gym_classes;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select * into v_class from public.gym_classes where id = p_class_id for update;
  if v_class.id is null then raise exception 'Class not found'; end if;
  perform 1 from public.gym_memberships
  where gym_id = v_class.gym_id and user_id = auth.uid()
    and membership_status in ('active', 'trial') and role in ('leader', 'officer', 'coach')
  for share;
  if not found then
    raise exception using errcode = '42501', message = 'Only gym staff can manage classes';
  end if;
  return v_class;
end;
$$;
revoke all on function public.lock_staff_class(uuid) from public, anon, authenticated, service_role;

create or replace function public.update_gym_class_by_staff(p_class_id uuid, p_patch jsonb)
returns public.gym_classes
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_class public.gym_classes;
  v_new public.gym_classes;
begin
  v_class := public.lock_staff_class(p_class_id);
  if jsonb_typeof(p_patch) is distinct from 'object' or exists (
    select 1 from jsonb_object_keys(p_patch) k where k not in (
      'coach_user_id', 'title', 'description', 'capacity', 'status', 'starts_at',
      'ends_at', 'booking_opens_at', 'booking_closes_at'
    )
  ) then raise exception 'Invalid class patch'; end if;
  v_new := jsonb_populate_record(v_class, p_patch);
  update public.gym_classes set
    coach_user_id = v_new.coach_user_id, title = v_new.title,
    description = v_new.description, capacity = v_new.capacity, status = v_new.status,
    starts_at = v_new.starts_at, ends_at = v_new.ends_at,
    booking_opens_at = v_new.booking_opens_at, booking_closes_at = v_new.booking_closes_at,
    updated_at = now()
  where id = p_class_id returning * into v_new;
  perform public.append_audit_log('class.updated', 'gym_classes', p_class_id,
    'Staff updated class', jsonb_build_object('patch', p_patch, 'gymId', v_class.gym_id));
  return v_new;
end;
$$;

create or replace function public.upsert_class_booking_by_staff(
  p_class_id uuid, p_user_id uuid, p_patch jsonb default '{}'::jsonb
)
returns public.class_bookings
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_class public.gym_classes;
  v_booking public.class_bookings;
  v_status public.booking_status;
begin
  v_class := public.lock_staff_class(p_class_id);
  if jsonb_typeof(p_patch) is distinct from 'object' or exists (
    select 1 from jsonb_object_keys(p_patch) k
    where k not in ('status', 'source_channel', 'checked_in_at')
  ) then raise exception 'Invalid booking patch'; end if;
  select * into v_booking from public.class_bookings
  where class_id = p_class_id and user_id = p_user_id for update;
  v_status := coalesce((p_patch->>'status')::public.booking_status, v_booking.status, 'booked');
  if v_status = 'waitlisted' then
    raise exception 'Use the class waitlist instead of legacy waitlisted bookings';
  end if;
  if v_status = 'booked' then
    perform 1 from public.gym_memberships where gym_id = v_class.gym_id
      and user_id = p_user_id and membership_status in ('active', 'trial') for update;
    if not found then raise exception 'Active or trial gym membership required'; end if;
    if v_class.status <> 'scheduled' or v_class.starts_at <= clock_timestamp() then
      raise exception 'Class is not scheduled before start';
    end if;
    if v_booking.status in ('attended', 'no_show') then
      raise exception 'Recorded attendance cannot be rebooked';
    end if;
    if v_booking.status is distinct from 'booked' then
      perform public.expire_ineligible_class_waitlist(p_class_id, v_class.gym_id);
      if exists (select 1 from public.class_waitlist where class_id = p_class_id and status = 'pending') then
        raise exception 'Class has a pending waitlist; promote queued members first';
      end if;
    end if;
  elsif v_status in ('attended', 'no_show') then
    if v_booking.id is null or v_booking.status not in ('booked', 'attended', 'no_show')
      or v_class.status = 'cancelled' or v_class.starts_at > clock_timestamp() then
      raise exception 'Attendance requires an existing booking after class start';
    end if;
    if v_status = 'no_show' and v_class.ends_at > clock_timestamp() then
      raise exception 'No-show requires an ended class';
    end if;
  elsif v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_class.status = 'cancelled' and v_status <> 'cancelled' then
    raise exception 'Class is cancelled';
  end if;
  if p_patch ? 'checked_in_at' and p_patch->>'checked_in_at' is not null
    and v_status <> 'attended' then
    raise exception 'Check-in requires attended status';
  end if;
  insert into public.class_bookings(class_id, user_id, status, source_channel, checked_in_at)
  values (p_class_id, p_user_id, v_status,
    coalesce(p_patch->>'source_channel', v_booking.source_channel, 'admin_panel'),
    case when v_status = 'attended' then coalesce((p_patch->>'checked_in_at')::timestamptz, v_booking.checked_in_at, now()) end)
  on conflict (class_id, user_id) do update set
    status = excluded.status, source_channel = excluded.source_channel,
    checked_in_at = excluded.checked_in_at, updated_at = now(),
    booked_at = case when excluded.status = 'booked' and class_bookings.status <> 'booked'
      then now() else class_bookings.booked_at end
  returning * into v_booking;
  perform public.append_audit_log('class.booking.staff_updated', 'class_bookings', v_booking.id,
    'Staff updated class booking', jsonb_build_object('classId', p_class_id, 'status', v_status));
  return v_booking;
end;
$$;

create or replace function public.update_class_waitlist_by_staff(p_waitlist_id uuid, p_patch jsonb)
returns public.class_waitlist
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_class_id uuid;
  v_class public.gym_classes;
  v_entry public.class_waitlist;
  v_new public.class_waitlist;
  v_booking_id uuid;
begin
  select class_id into v_class_id from public.class_waitlist where id = p_waitlist_id;
  v_class := public.lock_staff_class(v_class_id);
  select * into v_entry from public.class_waitlist where id = p_waitlist_id for update;
  if jsonb_typeof(p_patch) is distinct from 'object' or exists (
    select 1 from jsonb_object_keys(p_patch) k where k not in ('status', 'notified_at', 'expires_at')
  ) then raise exception 'Invalid waitlist patch'; end if;
  v_new := jsonb_populate_record(v_entry, p_patch);
  if v_class.status <> 'scheduled' or v_class.starts_at <= clock_timestamp() then
    raise exception 'Class is not scheduled before start';
  end if;
  if v_entry.status <> 'pending' then raise exception 'Only pending entries can be changed'; end if;
  if v_new.status = 'promoted' then
    -- Promotion chooses the eligible head; a mismatched target rolls back it all.
    v_booking_id := public.promote_waitlist_member(v_class_id);
    if not exists (select 1 from public.class_bookings where id = v_booking_id and user_id = v_entry.user_id) then
      raise exception 'Only the first eligible waitlist member can be promoted';
    end if;
    select * into v_new from public.class_waitlist where id = p_waitlist_id;
  else
    if v_new.status is null or v_new.status not in ('pending', 'cancelled', 'expired') then
      raise exception 'Invalid waitlist transition';
    end if;
    if v_new.status = 'pending' then
      perform 1 from public.gym_memberships where gym_id = v_class.gym_id
        and user_id = v_entry.user_id and membership_status in ('active', 'trial') for update;
      if not found then raise exception 'Active or trial gym membership required'; end if;
    end if;
    if v_class.starts_at <= clock_timestamp() then
      raise exception 'Class is not scheduled before start';
    end if;
    update public.class_waitlist set status = v_new.status, notified_at = v_new.notified_at,
      expires_at = v_new.expires_at, updated_at = now()
    where id = p_waitlist_id returning * into v_new;
  end if;
  perform public.append_audit_log('waitlist.staff_updated', 'class_waitlist', p_waitlist_id,
    'Staff updated waitlist', jsonb_build_object('classId', v_class_id, 'status', v_new.status));
  return v_new;
end;
$$;

-- RLS SELECT policies remain; all browser mutations must enter the locking RPCs.
revoke insert, update, delete on public.class_bookings, public.class_waitlist from authenticated, anon;
revoke update on public.gym_classes from authenticated, anon;
revoke all on function public.update_gym_class_by_staff(uuid, jsonb) from public, anon, service_role;
revoke all on function public.upsert_class_booking_by_staff(uuid, uuid, jsonb) from public, anon, service_role;
revoke all on function public.update_class_waitlist_by_staff(uuid, jsonb) from public, anon, service_role;
grant execute on function public.update_gym_class_by_staff(uuid, jsonb) to authenticated;
grant execute on function public.upsert_class_booking_by_staff(uuid, uuid, jsonb) to authenticated;
grant execute on function public.update_class_waitlist_by_staff(uuid, jsonb) to authenticated;

reset lock_timeout;
