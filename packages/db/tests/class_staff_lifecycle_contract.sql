begin;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);
create function pg_temp.expect_failure(p_sql text, p_message text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_message in sqlerrm) = 0 then raise; end if;
    return;
  end;
  raise exception 'Expected rejection: %', p_message;
end;
$$;

insert into auth.users(id, email)
select ('7e000000-0000-0000-0000-00000000000' || n)::uuid, 'staff-contract-' || n || '@example.test'
from generate_series(1,5) n;
insert into public.profiles(id, username, display_name)
select id, 'staff-contract-' || right(id::text,1), 'Staff contract'
from auth.users where id::text like '7e000000-%';
insert into public.gyms(id, owner_user_id, name, slug)
values ('7e000000-0000-0000-0000-000000000010', '7e000000-0000-0000-0000-000000000001', 'Staff contract', 'staff-contract');
insert into public.gym_memberships(gym_id, user_id, role, membership_status)
select '7e000000-0000-0000-0000-000000000010', id,
  case when right(id::text,1) = '1' then 'leader' else 'member' end::public.gym_role,
  case when right(id::text,1) = '4' then 'paused' else 'active' end::public.membership_status
from public.profiles where id::text like '7e000000-%' and right(id::text,1) <> '5';
insert into public.gym_classes(id, gym_id, title, capacity, starts_at, ends_at)
select ('7e000000-0000-0000-0000-00000000002' || n)::uuid,
  '7e000000-0000-0000-0000-000000000010', 'Staff contract', 3,
  now() + interval '2 hours', now() + interval '3 hours'
from generate_series(0,2) n;
insert into public.class_waitlist(class_id, user_id, position)
values
('7e000000-0000-0000-0000-000000000020','7e000000-0000-0000-0000-000000000002',1),
('7e000000-0000-0000-0000-000000000020','7e000000-0000-0000-0000-000000000003',2);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '7e000000-0000-0000-0000-000000000002', true);
select pg_temp.expect_failure($q$select public.update_gym_class_by_staff('7e000000-0000-0000-0000-000000000020','{"status":"cancelled"}')$q$, 'Only gym staff');
select pg_temp.expect_failure($q$select public.upsert_class_booking_by_staff('7e000000-0000-0000-0000-000000000021','7e000000-0000-0000-0000-000000000002')$q$, 'Only gym staff');
select pg_temp.expect_failure($q$select public.update_class_waitlist_by_staff((select id from public.class_waitlist where user_id = auth.uid() and class_id = '7e000000-0000-0000-0000-000000000020'),'{"status":"cancelled"}')$q$, 'Only gym staff');
select set_config('request.jwt.claim.sub', '7e000000-0000-0000-0000-000000000001', true);
select pg_temp.expect_failure($q$insert into public.class_bookings(class_id,user_id) values ('7e000000-0000-0000-0000-000000000021','7e000000-0000-0000-0000-000000000002')$q$, 'permission denied');
select pg_temp.expect_failure($q$update public.class_waitlist set status = 'promoted'$q$, 'permission denied');
select pg_temp.expect_failure($q$delete from public.class_bookings$q$, 'permission denied');
select pg_temp.expect_failure($q$update public.gym_classes set status = 'cancelled'$q$, 'permission denied');
select pg_temp.expect_failure($q$select public.lock_staff_class('7e000000-0000-0000-0000-000000000020')$q$, 'permission denied');
select pg_temp.expect_failure($q$select public.upsert_class_booking_by_staff('7e000000-0000-0000-0000-000000000021','7e000000-0000-0000-0000-000000000004')$q$, 'membership required');
select pg_temp.expect_failure($q$select public.upsert_class_booking_by_staff('7e000000-0000-0000-0000-000000000021','7e000000-0000-0000-0000-000000000005')$q$, 'membership required');
select pg_temp.expect_failure($q$select public.upsert_class_booking_by_staff('7e000000-0000-0000-0000-000000000020','7e000000-0000-0000-0000-000000000001')$q$, 'pending waitlist');
select pg_temp.expect_failure($q$select public.update_class_waitlist_by_staff((select id from public.class_waitlist where user_id = '7e000000-0000-0000-0000-000000000003' and class_id = '7e000000-0000-0000-0000-000000000020'),'{"status":"promoted"}')$q$, 'first eligible');
do $$ begin
  if exists (select 1 from public.class_bookings where class_id = '7e000000-0000-0000-0000-000000000020')
    or (select count(*) from public.class_waitlist where class_id = '7e000000-0000-0000-0000-000000000020' and status = 'pending') <> 2 then
    raise exception 'Wrong-target promotion was not rolled back';
  end if;
end $$;
select public.update_class_waitlist_by_staff(
  (select id from public.class_waitlist where user_id = '7e000000-0000-0000-0000-000000000002' and class_id = '7e000000-0000-0000-0000-000000000020'),
  '{"status":"promoted"}'
);
select public.upsert_class_booking_by_staff('7e000000-0000-0000-0000-000000000021','7e000000-0000-0000-0000-000000000002');
select pg_temp.expect_failure($q$select public.update_gym_class_by_staff('7e000000-0000-0000-0000-000000000020','{"status":"cancelled","capacity":0}')$q$, 'capacity');
do $$ begin
  if (select status from public.gym_classes where id = '7e000000-0000-0000-0000-000000000020') <> 'scheduled'
    or exists (select 1 from public.event_outbox where aggregate_id = '7e000000-0000-0000-0000-000000000020' and event_type = 'class.cancelled') then
    raise exception 'Invalid cancel-with-edits partially committed';
  end if;
end $$;
select public.update_gym_class_by_staff('7e000000-0000-0000-0000-000000000020','{"status":"cancelled","title":"Cancelled atomically"}');
select pg_temp.expect_failure($q$select public.update_gym_class_by_staff('7e000000-0000-0000-0000-000000000020','{"status":"scheduled"}')$q$, 'Terminal classes');
select pg_temp.expect_failure($q$select public.upsert_class_booking_by_staff('7e000000-0000-0000-0000-000000000020','7e000000-0000-0000-0000-000000000001')$q$, 'not scheduled');
select pg_temp.expect_failure($q$select public.update_gym_class_by_staff('7e000000-0000-0000-0000-000000000021','{"status":"completed"}')$q$, 'before it ends');
-- Build an ended scheduled class via the same staff edit API.
select public.update_gym_class_by_staff('7e000000-0000-0000-0000-000000000021',
  jsonb_build_object('starts_at', now()-interval '2 hours', 'ends_at', now()-interval '1 hour',
    'booking_opens_at', now()-interval '4 hours', 'booking_closes_at', now()-interval '3 hours'));
reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into public.class_bookings(class_id,user_id,status) values
('7e000000-0000-0000-0000-000000000021','7e000000-0000-0000-0000-000000000003','attended'),
('7e000000-0000-0000-0000-000000000021','7e000000-0000-0000-0000-000000000004','waitlisted');
insert into public.class_waitlist(class_id,user_id,position)
values ('7e000000-0000-0000-0000-000000000021','7e000000-0000-0000-0000-000000000005',1);
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.update_gym_class_by_staff('7e000000-0000-0000-0000-000000000021','{"status":"completed"}');
select public.update_gym_class_by_staff('7e000000-0000-0000-0000-000000000021','{"status":"completed"}');
do $$ begin
  if exists (select 1 from public.class_bookings where class_id in ('7e000000-0000-0000-0000-000000000020','7e000000-0000-0000-0000-000000000021') and status in ('booked','waitlisted'))
    or exists (select 1 from public.class_waitlist where class_id in ('7e000000-0000-0000-0000-000000000020','7e000000-0000-0000-0000-000000000021') and status = 'pending')
    or (select status from public.class_bookings where class_id = '7e000000-0000-0000-0000-000000000021' and user_id = '7e000000-0000-0000-0000-000000000003') <> 'attended' then
    raise exception 'Terminal cleanup stranded children or overwrote attendance';
  end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.event_outbox where aggregate_id = '7e000000-0000-0000-0000-000000000021' and event_type = 'class.completed') <> 1
    or (select count(*) from public.audit_logs where target_id = '7e000000-0000-0000-0000-000000000021' and action = 'class.completed') <> 1 then
    raise exception 'Completion audit/outbox must be emitted exactly once';
  end if;
end $$;
set local role anon;
select pg_temp.expect_failure($q$select public.update_gym_class_by_staff('7e000000-0000-0000-0000-000000000021','{}')$q$, 'permission denied');
select pg_temp.expect_failure($q$select public.upsert_class_booking_by_staff('7e000000-0000-0000-0000-000000000021','7e000000-0000-0000-0000-000000000002')$q$, 'permission denied');
select pg_temp.expect_failure($q$select public.update_class_waitlist_by_staff('7e000000-0000-0000-0000-000000000021','{}')$q$, 'permission denied');
reset role;
rollback;
\echo '[ok] staff authorization, queue fairness, atomic edits and completion cleanup'
