-- Run against a fully migrated disposable database.
-- The transaction rolls back every fixture and mutation.

begin;

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
  v_booking_one uuid;
  v_booking_two uuid;
  v_waitlist_one uuid;
  v_waitlist_two uuid;
  v_position_one integer;
  v_position_two integer;
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
    );

  perform set_config('request.jwt.claim.role', 'authenticated', true);
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

  if has_function_privilege('authenticated', 'public.enforce_class_booking_capacity()', 'execute') then
    raise exception 'capacity trigger privilege invariant failed';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'uq_class_waitlist_pending_position'
      and indexdef ilike '%unique%where (status = ''pending''%'
  ) then
    raise exception 'pending waitlist unique index invariant failed';
  end if;

  -- Leave room so the following direct reactivation check reaches RLS rather
  -- than being rejected earlier by the capacity trigger.
  update public.gym_classes
  set capacity = 2
  where id = v_open_class;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '7a000000-0000-0000-0000-000000000002', true);

do $$
declare
  v_rejected boolean := false;
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

  v_rejected := false;
  begin
    update public.class_bookings
    set status = 'booked'
    where class_id = '7a000000-0000-0000-0000-000000000020'
      and user_id = '7a000000-0000-0000-0000-000000000002';
  exception when insufficient_privilege then
    v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'RLS invariant failed: member direct booking reactivation succeeded';
  end if;
end;
$$;

reset role;
rollback;
