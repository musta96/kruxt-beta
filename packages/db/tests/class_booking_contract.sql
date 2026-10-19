-- Run against a fully migrated disposable database.
-- The transaction rolls back every fixture and mutation.

begin;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  v_owner uuid := '7a000000-0000-0000-0000-000000000001';
  v_member_one uuid := '7a000000-0000-0000-0000-000000000002';
  v_member_two uuid := '7a000000-0000-0000-0000-000000000003';
  v_member_three uuid := '7a000000-0000-0000-0000-000000000004';
  v_paused_member uuid := '7a000000-0000-0000-0000-000000000005';
  v_gym uuid := '7a000000-0000-0000-0000-000000000010';
  v_open_class uuid := '7a000000-0000-0000-0000-000000000020';
  v_closed_class uuid := '7a000000-0000-0000-0000-000000000021';
  v_promotion_class uuid := '7a000000-0000-0000-0000-000000000022';
  v_ended_class uuid := '7a000000-0000-0000-0000-000000000023';
  v_cancelled_class uuid := '7a000000-0000-0000-0000-000000000024';
  v_default_window_class uuid := '7a000000-0000-0000-0000-000000000025';
  v_lifecycle_class uuid := '7a000000-0000-0000-0000-000000000026';
  v_stale_waitlist uuid := '7a000000-0000-0000-0000-000000000030';
  v_eligible_waitlist uuid := '7a000000-0000-0000-0000-000000000031';
  v_booking_one uuid;
  v_booking_two uuid;
  v_promoted_booking uuid;
  v_waitlist_one uuid;
  v_waitlist_two uuid;
  v_late_booking uuid;
  v_late_waitlist uuid;
  v_ended_booking uuid;
  v_ended_waitlist uuid;
  v_lifecycle_booking_one uuid;
  v_lifecycle_booking_two uuid;
  v_lifecycle_waitlist uuid;
  v_position_one integer;
  v_position_two integer;
  v_booking_before public.class_bookings%rowtype;
  v_booking_after public.class_bookings%rowtype;
  v_waitlist_before public.class_waitlist%rowtype;
  v_waitlist_after public.class_waitlist%rowtype;
  v_rejected boolean;
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  select
    user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    email,
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  from (
    values
      (v_owner, 'booking-owner@example.test'),
      (v_member_one, 'booking-member-one@example.test'),
      (v_member_two, 'booking-member-two@example.test'),
      (v_member_three, 'booking-member-three@example.test'),
      (v_paused_member, 'booking-paused@example.test')
  ) as fixtures(user_id, email)
  on conflict (id) do nothing;

  insert into public.profiles (id, username, display_name)
  values
    (v_owner, 'booking-owner', 'Booking Owner'),
    (v_member_one, 'booking-member-one', 'Booking Member One'),
    (v_member_two, 'booking-member-two', 'Booking Member Two'),
    (v_member_three, 'booking-member-three', 'Booking Member Three'),
    (v_paused_member, 'booking-paused', 'Booking Paused Member')
  on conflict (id) do update set display_name = excluded.display_name;

  insert into public.gyms (id, owner_user_id, name, slug)
  values (v_gym, v_owner, 'Booking Contract Gym', 'booking-contract-gym')
  on conflict (id) do nothing;

  insert into public.gym_memberships (gym_id, user_id, role, membership_status)
  values
    (v_gym, v_owner, 'leader', 'active'),
    (v_gym, v_member_one, 'member', 'active'),
    (v_gym, v_member_two, 'member', 'trial'),
    (v_gym, v_member_three, 'member', 'active'),
    (v_gym, v_paused_member, 'member', 'paused')
  on conflict (gym_id, user_id) do update
  set membership_status = excluded.membership_status;

  insert into public.gym_classes (
    id,
    gym_id,
    coach_user_id,
    title,
    capacity,
    status,
    starts_at,
    ends_at,
    booking_opens_at,
    booking_closes_at
  )
  values
    (
      v_open_class,
      v_gym,
      v_owner,
      'Atomic Booking Test',
      1,
      'scheduled',
      now() + interval '2 hours',
      now() + interval '3 hours',
      now() - interval '1 hour',
      now() + interval '1 hour'
    ),
    (
      v_closed_class,
      v_gym,
      v_owner,
      'Closed Booking Test',
      10,
      'scheduled',
      now() + interval '2 hours',
      now() + interval '3 hours',
      now() - interval '2 hours',
      now() - interval '1 hour'
    ),
    (
      v_promotion_class,
      v_gym,
      v_owner,
      'Late Staff Promotion Test',
      1,
      'scheduled',
      now() + interval '4 hours',
      now() + interval '5 hours',
      now() - interval '2 hours',
      now() - interval '1 hour'
    ),
    (
      v_ended_class,
      v_gym,
      v_owner,
      'Ended Promotion Test',
      1,
      'scheduled',
      now() - interval '2 hours',
      now() - interval '1 hour',
      now() - interval '4 hours',
      now() - interval '3 hours'
    ),
    (
      v_cancelled_class,
      v_gym,
      v_owner,
      'Cancelled Promotion Test',
      1,
      'cancelled',
      now() + interval '4 hours',
      now() + interval '5 hours',
      now() - interval '1 hour',
      now() + interval '1 hour'
    );

  insert into public.gym_classes (
    id,
    gym_id,
    coach_user_id,
    title,
    capacity,
    status,
    starts_at,
    ends_at
  )
  values
    (
      v_default_window_class,
      v_gym,
      v_owner,
      'Default Booking Window Test',
      2,
      'scheduled',
      now() + interval '4 hours',
      now() + interval '5 hours'
    ),
    (
      v_lifecycle_class,
      v_gym,
      v_owner,
      'Class Lifecycle Test',
      2,
      'scheduled',
      now() + interval '4 hours',
      now() + interval '5 hours'
    );

  if not exists (
    select 1
    from public.gym_classes gc
    where gc.id = v_default_window_class
      and gc.booking_opens_at is not null
      and gc.booking_closes_at is not null
      and gc.booking_opens_at <= gc.booking_closes_at
      and gc.booking_closes_at <= gc.starts_at
  ) then
    raise exception 'admin schedule-to-bookability invariant failed: booking window was not defaulted';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_member_three::text, true);
  if public.book_gym_class(v_default_window_class) is null then
    raise exception 'admin schedule-to-bookability invariant failed: defaulted class was not bookable';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_two::text, true);
  v_rejected := false;
  begin
    perform public.join_waitlist(v_default_window_class);
  exception when others then
    if position('available capacity' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'waitlist fairness invariant failed: member queued while seats were available';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_one::text, true);
  v_booking_one := public.book_gym_class(v_open_class);

  if public.book_gym_class(v_open_class) <> v_booking_one then
    raise exception 'book_gym_class is not idempotent for an active booking';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_two::text, true);
  v_rejected := false;
  begin
    perform public.book_gym_class(v_open_class);
  exception when others then
    if position('Class capacity reached' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'capacity invariant failed: second member was booked';
  end if;

  perform set_config('request.jwt.claim.sub', v_paused_member::text, true);
  v_rejected := false;
  begin
    perform public.book_gym_class(v_open_class);
  exception when insufficient_privilege then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'membership invariant failed: paused member was booked';
  end if;

  update public.class_bookings
  set status = 'cancelled'
  where id = v_booking_one;

  perform set_config('request.jwt.claim.sub', v_member_two::text, true);
  v_booking_two := public.book_gym_class(v_open_class);
  if v_booking_two is null then
    raise exception 'trial member booking was not created';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_one::text, true);
  v_waitlist_one := public.join_waitlist(v_open_class);
  if public.join_waitlist(v_open_class) <> v_waitlist_one then
    raise exception 'join_waitlist is not idempotent for a pending entry';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_three::text, true);
  v_waitlist_two := public.join_waitlist(v_open_class);

  select position into v_position_one
  from public.class_waitlist
  where id = v_waitlist_one;

  select position into v_position_two
  from public.class_waitlist
  where id = v_waitlist_two;

  if v_position_one <> 1 or v_position_two <> 2 then
    raise exception 'waitlist position invariant failed: expected 1,2 and found %,%', v_position_one, v_position_two;
  end if;

  perform set_config('request.jwt.claim.sub', v_member_two::text, true);
  v_rejected := false;
  begin
    perform public.join_waitlist(v_open_class);
  exception when others then
    if position('already booked or attended' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'booking-state invariant failed: booked member joined waitlist';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_one::text, true);
  v_rejected := false;
  begin
    perform public.book_gym_class(v_open_class);
  exception when others then
    if position('Leave the waitlist' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'waitlist-state invariant failed: pending member was booked';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_three::text, true);
  v_rejected := false;
  begin
    perform public.book_gym_class(v_closed_class);
  exception when others then
    if position('booking has closed' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'booking-window invariant failed: closed class was booked';
  end if;

  v_rejected := false;
  begin
    perform public.join_waitlist(v_closed_class);
  exception when others then
    if position('booking has closed' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'waitlist-window invariant failed: closed class accepted waitlist';
  end if;

  insert into public.class_bookings(class_id, user_id, status, source_channel)
  values (v_closed_class, v_member_three, 'booked', 'late_cancel_fixture')
  returning id into v_late_booking;

  insert into public.class_waitlist(class_id, user_id, position, status)
  values (v_closed_class, v_member_one, 1, 'pending')
  returning id into v_late_waitlist;

  perform set_config('request.jwt.claim.sub', v_member_three::text, true);
  if public.cancel_gym_class_booking(v_late_booking) <> v_late_booking then
    raise exception 'late cancellation invariant failed: booking close blocked cancellation';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_one::text, true);
  if public.leave_class_waitlist(v_late_waitlist) <> v_late_waitlist then
    raise exception 'late cancellation invariant failed: booking close blocked waitlist exit';
  end if;

  insert into public.class_bookings(class_id, user_id, status, source_channel)
  values (v_ended_class, v_member_two, 'booked', 'ended_cancel_fixture')
  returning id into v_ended_booking;

  insert into public.class_waitlist(class_id, user_id, position, status)
  values (v_ended_class, v_member_one, 1, 'pending')
  returning id into v_ended_waitlist;

  perform set_config('request.jwt.claim.sub', v_member_two::text, true);
  v_rejected := false;
  begin
    perform public.cancel_gym_class_booking(v_ended_booking);
  exception when others then
    if position('Class has ended' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'late cancellation invariant failed: ended class booking was cancelled';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_one::text, true);
  v_rejected := false;
  begin
    perform public.leave_class_waitlist(v_ended_waitlist);
  exception when others then
    if position('Class has ended' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'late cancellation invariant failed: ended class waitlist was left';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_two::text, true);
  select * into v_booking_before
  from public.class_bookings
  where id = v_booking_two;

  if public.cancel_gym_class_booking(v_booking_two) <> v_booking_two
    or public.cancel_gym_class_booking(v_booking_two) <> v_booking_two then
    raise exception 'cancel_gym_class_booking idempotency invariant failed';
  end if;

  select * into v_booking_after
  from public.class_bookings
  where id = v_booking_two;

  if v_booking_after.status <> 'cancelled'
    or row(
      v_booking_after.class_id,
      v_booking_after.user_id,
      v_booking_after.booked_at,
      v_booking_after.checked_in_at,
      v_booking_after.source_channel
    ) is distinct from row(
      v_booking_before.class_id,
      v_booking_before.user_id,
      v_booking_before.booked_at,
      v_booking_before.checked_in_at,
      v_booking_before.source_channel
    ) then
    raise exception 'cancel_gym_class_booking immutable-column invariant failed';
  end if;

  v_rejected := false;
  begin
    perform public.book_gym_class(v_open_class);
  exception when others then
    if position('pending waitlist' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'booking fairness invariant failed: fresh booking bypassed pending queue';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_one::text, true);
  select * into v_waitlist_before
  from public.class_waitlist
  where id = v_waitlist_one;

  if public.leave_class_waitlist(v_waitlist_one) <> v_waitlist_one
    or public.leave_class_waitlist(v_waitlist_one) <> v_waitlist_one then
    raise exception 'leave_class_waitlist idempotency invariant failed';
  end if;

  select * into v_waitlist_after
  from public.class_waitlist
  where id = v_waitlist_one;

  if v_waitlist_after.status <> 'cancelled'
    or row(
      v_waitlist_after.class_id,
      v_waitlist_after.user_id,
      v_waitlist_after.position,
      v_waitlist_after.notified_at,
      v_waitlist_after.expires_at,
      v_waitlist_after.promoted_at,
      v_waitlist_after.created_at
    ) is distinct from row(
      v_waitlist_before.class_id,
      v_waitlist_before.user_id,
      v_waitlist_before.position,
      v_waitlist_before.notified_at,
      v_waitlist_before.expires_at,
      v_waitlist_before.promoted_at,
      v_waitlist_before.created_at
    ) then
    raise exception 'leave_class_waitlist immutable-column invariant failed';
  end if;

  insert into public.class_waitlist(id, class_id, user_id, position, status, created_at)
  values
    (v_stale_waitlist, v_promotion_class, v_paused_member, 1, 'pending', now() - interval '2 minutes'),
    (v_eligible_waitlist, v_promotion_class, v_member_three, 2, 'pending', now() - interval '1 minute');

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_promoted_booking := public.promote_waitlist_member(v_promotion_class);

  if not exists (
    select 1
    from public.class_bookings cb
    where cb.id = v_promoted_booking
      and cb.class_id = v_promotion_class
      and cb.user_id = v_member_three
      and cb.status = 'booked'
  ) then
    raise exception 'promotion membership invariant failed: eligible member was not promoted';
  end if;

  if not exists (
    select 1
    from public.class_waitlist cw
    where cw.id = v_stale_waitlist
      and cw.status = 'expired'
  ) or not exists (
    select 1
    from public.class_waitlist cw
    where cw.id = v_eligible_waitlist
      and cw.status = 'promoted'
  ) then
    raise exception 'promotion membership invariant failed: stale membership was promoted';
  end if;

  v_rejected := false;
  begin
    perform public.promote_waitlist_member(v_ended_class);
  exception when others then
    if position('Class has ended' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'promotion time invariant failed: ended class accepted promotion';
  end if;

  v_rejected := false;
  begin
    perform public.promote_waitlist_member(v_cancelled_class);
  exception when others then
    if position('Class is not scheduled' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'promotion status invariant failed: cancelled class accepted promotion';
  end if;

  insert into public.class_bookings(class_id, user_id, status, source_channel)
  values (v_lifecycle_class, v_member_one, 'booked', 'lifecycle_fixture')
  returning id into v_lifecycle_booking_one;

  insert into public.class_bookings(class_id, user_id, status, source_channel)
  values (v_lifecycle_class, v_member_two, 'booked', 'lifecycle_fixture')
  returning id into v_lifecycle_booking_two;

  insert into public.class_waitlist(class_id, user_id, position, status)
  values (v_lifecycle_class, v_member_three, 1, 'pending')
  returning id into v_lifecycle_waitlist;

  v_rejected := false;
  begin
    update public.gym_classes
    set capacity = 1
    where id = v_lifecycle_class;
  exception when others then
    if position('cannot be lower than active bookings' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'capacity reduction invariant failed: capacity dropped below active bookings';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  if public.cancel_gym_class(v_lifecycle_class) <> v_lifecycle_class then
    raise exception 'class cancellation invariant failed: RPC did not return class id';
  end if;

  if not exists (
    select 1
    from public.gym_classes gc
    where gc.id = v_lifecycle_class
      and gc.status = 'cancelled'
  ) or (
    select count(*)
    from public.class_bookings cb
    where cb.id in (v_lifecycle_booking_one, v_lifecycle_booking_two)
      and cb.status = 'cancelled'
  ) <> 2 or not exists (
    select 1
    from public.class_waitlist cw
    where cw.id = v_lifecycle_waitlist
      and cw.status = 'cancelled'
  ) then
    raise exception 'class cancellation invariant failed: child state was not cascaded';
  end if;

  if not exists (
    select 1
    from public.event_outbox eo
    where eo.event_type = 'class.cancelled'
      and eo.aggregate_id = v_lifecycle_class
  ) or not exists (
    select 1
    from public.audit_logs al
    where al.action = 'class.cancelled'
      and al.target_id = v_lifecycle_class
  ) then
    raise exception 'class cancellation invariant failed: lifecycle event or audit was not emitted';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_one::text, true);
  v_rejected := false;
  begin
    perform public.cancel_gym_class_booking(v_lifecycle_booking_one);
  exception when others then
    if position('Class is not scheduled' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'class cancellation invariant failed: member cancellation accepted cancelled class';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_three::text, true);
  v_rejected := false;
  begin
    perform public.leave_class_waitlist(v_lifecycle_waitlist);
  exception when others then
    if position('Class is not scheduled' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'class cancellation invariant failed: waitlist exit accepted cancelled class';
  end if;

  if not has_function_privilege('authenticated', 'public.book_gym_class(uuid)', 'execute')
    or has_function_privilege('anon', 'public.book_gym_class(uuid)', 'execute')
    or has_function_privilege('service_role', 'public.book_gym_class(uuid)', 'execute') then
    raise exception 'book_gym_class privilege invariant failed';
  end if;

  if not has_function_privilege('authenticated', 'public.join_waitlist(uuid)', 'execute')
    or has_function_privilege('anon', 'public.join_waitlist(uuid)', 'execute')
    or has_function_privilege('service_role', 'public.join_waitlist(uuid)', 'execute') then
    raise exception 'join_waitlist privilege invariant failed';
  end if;

  if not has_function_privilege('authenticated', 'public.promote_waitlist_member(uuid)', 'execute')
    or has_function_privilege('anon', 'public.promote_waitlist_member(uuid)', 'execute')
    or has_function_privilege('service_role', 'public.promote_waitlist_member(uuid)', 'execute') then
    raise exception 'promote_waitlist_member privilege invariant failed';
  end if;

  if not has_function_privilege('authenticated', 'public.cancel_gym_class_booking(uuid)', 'execute')
    or has_function_privilege('anon', 'public.cancel_gym_class_booking(uuid)', 'execute')
    or has_function_privilege('service_role', 'public.cancel_gym_class_booking(uuid)', 'execute') then
    raise exception 'cancel_gym_class_booking privilege invariant failed';
  end if;

  if not has_function_privilege('authenticated', 'public.leave_class_waitlist(uuid)', 'execute')
    or has_function_privilege('anon', 'public.leave_class_waitlist(uuid)', 'execute')
    or has_function_privilege('service_role', 'public.leave_class_waitlist(uuid)', 'execute') then
    raise exception 'leave_class_waitlist privilege invariant failed';
  end if;

  if not has_function_privilege('authenticated', 'public.cancel_gym_class(uuid)', 'execute')
    or has_function_privilege('anon', 'public.cancel_gym_class(uuid)', 'execute')
    or has_function_privilege('service_role', 'public.cancel_gym_class(uuid)', 'execute') then
    raise exception 'cancel_gym_class privilege invariant failed';
  end if;

  if has_function_privilege('authenticated', 'public.enforce_class_booking_capacity()', 'execute') then
    raise exception 'capacity trigger privilege invariant failed';
  end if;

  if has_function_privilege('authenticated', 'public.enforce_gym_class_lifecycle()', 'execute')
    or has_function_privilege('authenticated', 'public.cascade_terminal_class_state()', 'execute')
    or has_function_privilege('authenticated', 'public.expire_ineligible_class_waitlist(uuid,uuid)', 'execute') then
    raise exception 'class lifecycle trigger privilege invariant failed';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where not tgisinternal and tgname = 'trg_class_waitlist_enforce_position'
  ) then
    raise exception 'pending waitlist position trigger invariant failed';
  end if;

  if (
    select count(*)
    from pg_trigger
    where not tgisinternal
      and tgname in ('trg_gym_classes_enforce_lifecycle', 'trg_gym_classes_cascade_terminal_state')
  ) <> 2 or not exists (
    select 1
    from pg_constraint
    where conname = 'gym_classes_scheduled_booking_window_check'
  ) then
    raise exception 'class lifecycle schema invariant failed';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('class_bookings', 'class_waitlist')
      and policyname like '%update_self_or_staff'
  ) or (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and policyname in ('class_bookings_update_staff_only', 'class_waitlist_update_staff_only')
  ) <> 2 then
    raise exception 'member update policy invariant failed';
  end if;

end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '7a000000-0000-0000-0000-000000000002', true);

do $$
declare
  v_rejected boolean := false;
  v_rows integer := 0;
begin
  begin
    insert into public.class_bookings(class_id, user_id, status, source_channel)
    values (
      '7a000000-0000-0000-0000-000000000021',
      '7a000000-0000-0000-0000-000000000002',
      'booked',
      'rls_bypass_test'
    );
  exception when insufficient_privilege then
    v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'RLS invariant failed: member direct booking insert succeeded';
  end if;

  begin
    update public.class_bookings
    set class_id = '7a000000-0000-0000-0000-000000000021',
        user_id = '7a000000-0000-0000-0000-000000000005',
        status = 'cancelled',
        booked_at = '2000-01-01 00:00:00+00',
        checked_in_at = '2000-01-01 01:00:00+00',
        source_channel = 'member_rewrite_attempt'
    where class_id = '7a000000-0000-0000-0000-000000000020'
      and user_id = '7a000000-0000-0000-0000-000000000002';
    get diagnostics v_rows = row_count;
  exception when insufficient_privilege then
    v_rows := 0;
  end;

  if v_rows <> 0 then
    raise exception 'RLS invariant failed: member rewrote booking columns while cancelling';
  end if;

  begin
    update public.class_waitlist
    set class_id = '7a000000-0000-0000-0000-000000000021',
        user_id = '7a000000-0000-0000-0000-000000000005',
        position = 99,
        status = 'cancelled',
        notified_at = '2000-01-01 00:00:00+00',
        expires_at = '2000-01-01 01:00:00+00',
        promoted_at = '2000-01-01 02:00:00+00',
        created_at = '2000-01-01 03:00:00+00'
    where class_id = '7a000000-0000-0000-0000-000000000020'
      and user_id = '7a000000-0000-0000-0000-000000000002';
    get diagnostics v_rows = row_count;
  exception when insufficient_privilege then
    v_rows := 0;
  end;

  if v_rows <> 0 then
    raise exception 'RLS invariant failed: member rewrote waitlist columns while leaving';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '7a000000-0000-0000-0000-000000000001', true);

do $$
declare
  v_rows integer;
begin
  if auth.uid() <> '7a000000-0000-0000-0000-000000000001'::uuid
    or not public.is_gym_staff(
      '7a000000-0000-0000-0000-000000000010',
      auth.uid()
    ) then
    raise exception 'staff update invariant failed: owner fixture is not authorized';
  end if;

  if not exists (
    select 1
    from public.class_bookings
    where class_id = '7a000000-0000-0000-0000-000000000020'
      and user_id = '7a000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'staff update invariant failed: booking row is not visible';
  end if;

  begin
    update public.class_bookings set source_channel = 'staff_contract_test'
    where class_id = '7a000000-0000-0000-0000-000000000020';
    raise exception 'Staff direct booking writes must be denied';
  exception when insufficient_privilege then null;
  end;
  perform public.upsert_class_booking_by_staff(
    '7a000000-0000-0000-0000-000000000020',
    '7a000000-0000-0000-0000-000000000002',
    '{"status":"cancelled","source_channel":"staff_contract_test"}'
  );

  begin
    update public.class_waitlist set position = 10
    where class_id = '7a000000-0000-0000-0000-000000000020';
    raise exception 'Staff direct waitlist writes must be denied';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
