begin;
select set_config('request.jwt.claim.role','service_role',true);
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Assertion failed: %',label; end if; end $$;
create function pg_temp.denied(statement text,pattern text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(pattern in sqlerrm)=0 then raise; end if; return;
  end;
  raise exception 'Expected failure: %',pattern;
end $$;
insert into auth.users(id,email)
select ('78000000-0000-4000-8000-00000000000'||n)::uuid,'series-'||n||'@example.test' from generate_series(1,9)n;
insert into public.profiles(id,username,display_name)
select id,'series-'||right(id::text,1),'Series fixture' from auth.users where id::text like '78000000-%';
insert into public.gyms(id,owner_user_id,name,slug) values
('78000000-0000-4000-8000-000000000010','78000000-0000-4000-8000-000000000001','Series A','series-a'),
('78000000-0000-4000-8000-000000000011','78000000-0000-4000-8000-000000000007','Series B','series-b');
insert into public.gym_memberships(gym_id,user_id,role,membership_status)
select '78000000-0000-4000-8000-000000000010',id,
  case right(id::text,1) when '1' then 'leader' when '8' then 'coach' when '9' then 'officer' else 'member' end::public.gym_role,
  case when right(id::text,1)='5' then 'paused' else 'active' end::public.membership_status
from public.profiles where id::text like '78000000-%' and right(id::text,1) not in ('6','7');
insert into public.gym_memberships(gym_id,user_id,role,membership_status)
values('78000000-0000-4000-8000-000000000011','78000000-0000-4000-8000-000000000007','leader','active');
create function pg_temp.draft() returns jsonb language sql as $$
  select jsonb_build_object('version',1,'id','78000000-0000-4000-8000-000000000020','title','Spartan','timeZone','Europe/Rome',
    'startDate','2099-05-04','endDate','2099-05-17',
    'slots','[{"id":"mon","weekday":1,"startTime":"20:00","endTime":"21:00"},{"id":"wed","weekday":3,"startTime":"20:00","endTime":"21:00"},{"id":"tue","weekday":2,"startTime":"18:00","endTime":"19:00"},{"id":"thu","weekday":4,"startTime":"18:00","endTime":"19:00"}]'::jsonb,
    'excludedDates',jsonb_build_array((date '2099-05-04'+((2-extract(isodow from date '2099-05-04')::int+7)%7))::text))
$$;
create function pg_temp.publish() returns jsonb language sql as $$
  select public.publish_gym_class_series('78000000-0000-4000-8000-000000000010',pg_temp.draft(),12,'Fixture',null)
$$;
select pg_temp.denied($q$select public.class_series_instant('2027-03-28 02:30','Europe/Rome')$q$,'Ambiguous or nonexistent');
select pg_temp.denied($q$select public.class_series_instant('2027-10-31 02:30','Europe/Rome')$q$,'Ambiguous or nonexistent');
select pg_temp.ok(public.class_series_instant('2027-03-30 18:00','Europe/Rome')='2027-03-30T16:00:00Z','DST preserves 18:00 civil time');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000002',true);
select pg_temp.denied('select pg_temp.publish()','Active gym staff');
select pg_temp.denied($q$select public.require_class_series_staff('78000000-0000-4000-8000-000000000010')$q$,'permission denied');
select set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000001',true);
select pg_temp.ok(jsonb_array_length(pg_temp.publish()->'occurrences')=7,'four slots each week, one holiday, seven rows');
select pg_temp.ok((pg_temp.publish()->>'replayed')::boolean,'identical retry reuses series');
select pg_temp.ok((select count(*)=7 from public.gym_classes where series_id='78000000-0000-4000-8000-000000000020'),'retry never duplicates');
select pg_temp.denied($q$select public.publish_gym_class_series('78000000-0000-4000-8000-000000000010',pg_temp.draft(),13,'Fixture',null)$q$,'conflicts');
select pg_temp.denied($q$insert into public.gym_class_series_subscriptions(series_id,user_id) values('78000000-0000-4000-8000-000000000020',auth.uid())$q$,'permission denied');
select pg_temp.denied($q$select public.publish_gym_class_series('78000000-0000-4000-8000-000000000010',pg_temp.draft()||'{"id":"78000000-0000-4000-8000-000000000021","slots":[{"id":"x","weekday":1,"startTime":"20:00","endTime":"21:00"},{"id":"y","weekday":1,"startTime":"20:30","endTime":"21:30"}]}',12)$q$,'overlap');
select pg_temp.ok(not exists(select 1 from public.gym_class_series where id='78000000-0000-4000-8000-000000000021'),'invalid series rolled back');
select set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000007',true);
select pg_temp.denied('select pg_temp.publish()','Active gym staff');
select pg_temp.ok((select count(*)=0 from public.gym_class_series),'another gym staff cannot read series');
select set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000005',true);
select pg_temp.denied($q$select public.subscribe_gym_class_series('78000000-0000-4000-8000-000000000020',true)$q$,'Active gym membership');
select set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000002',true);
select public.subscribe_gym_class_series('78000000-0000-4000-8000-000000000020',true);
select public.subscribe_gym_class_series('78000000-0000-4000-8000-000000000020',true);
select pg_temp.ok((select count(*)=1 from public.gym_class_series_subscriptions),'subscription idempotent and owner-scoped');
reset role;
select set_config('request.jwt.claim.role','service_role',true);
create temporary table fixture_occurrence as select id from public.gym_classes where series_id='78000000-0000-4000-8000-000000000020' order by starts_at limit 1;
grant select on fixture_occurrence to authenticated;
insert into public.class_bookings(class_id,user_id,status)
select id,'78000000-0000-4000-8000-000000000003','booked' from fixture_occurrence;
insert into public.class_waitlist(class_id,user_id,position)
select id,'78000000-0000-4000-8000-000000000004',1 from fixture_occurrence;
update public.gym_classes set coach_user_id='78000000-0000-4000-8000-000000000008' where id=(select id from fixture_occurrence);
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000008',true);
select pg_temp.denied('select pg_temp.publish()','Only a gym leader or officer');
select pg_temp.denied($q$select public.announce_gym_class_series('78000000-0000-4000-8000-000000000020','series_subscribers','Too broad','78000000-0000-4000-8000-000000000034')$q$,'Only a gym leader or officer');
select pg_temp.denied($q$select public.announce_gym_class_series('78000000-0000-4000-8000-000000000020','occurrence_attendees','Another coach','78000000-0000-4000-8000-000000000035',(select id from public.gym_classes where series_id='78000000-0000-4000-8000-000000000020' and id<>(select id from fixture_occurrence) limit 1),true)$q$,'Only authorized staff');
savepoint own_coach_announcement;
select pg_temp.ok((public.announce_gym_class_series('78000000-0000-4000-8000-000000000020','occurrence_attendees','Own class','78000000-0000-4000-8000-000000000036',(select id from fixture_occurrence))->>'recipientCount')::int=2,'coach can announce only assigned occurrence');
rollback to own_coach_announcement;
reset role;
-- A later legitimate reschedule must not rewrite the immutable publication receipt.
update public.gym_classes set starts_at=starts_at+interval '1 hour',ends_at=ends_at+interval '1 hour',booking_closes_at=booking_closes_at+interval '1 hour'
where id=(select id from fixture_occurrence);
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000001',true);
select pg_temp.ok(pg_temp.publish()->'occurrences'=(select publication_receipt from public.gym_class_series where id='78000000-0000-4000-8000-000000000020'),'rescheduling retains original receipt');
reset role;
insert into public.gym_user_permission_overrides(gym_id,user_id,permission_key,is_allowed)
values('78000000-0000-4000-8000-000000000010','78000000-0000-4000-8000-000000000001','ops.classes.manage',false);
set local role authenticated;
select pg_temp.denied('select pg_temp.publish()','Class management permission');
reset role;
delete from public.gym_user_permission_overrides where gym_id='78000000-0000-4000-8000-000000000010' and permission_key='ops.classes.manage';
insert into public.gym_capability_overrides(gym_id,capability_key,bool_value)
values('78000000-0000-4000-8000-000000000010','classes_scheduling',false);
set local role authenticated;
select pg_temp.denied('select pg_temp.publish()','Class management permission');
reset role;
delete from public.gym_capability_overrides where gym_id='78000000-0000-4000-8000-000000000010' and capability_key='classes_scheduling';
set local role authenticated;
select pg_temp.ok((public.announce_gym_class_series('78000000-0000-4000-8000-000000000020','series_subscribers','Schedule update','78000000-0000-4000-8000-000000000030')->>'recipientCount')::int=1,'series targets only subscribed active members');
select pg_temp.ok((public.announce_gym_class_series('78000000-0000-4000-8000-000000000020','occurrence_attendees','Cancelled today','78000000-0000-4000-8000-000000000031',(select id from fixture_occurrence),true)->>'recipientCount')::int=2,'cancellation snapshots booked and waitlisted recipients');
select pg_temp.ok((public.announce_gym_class_series('78000000-0000-4000-8000-000000000020','occurrence_attendees','Cancelled today','78000000-0000-4000-8000-000000000031',(select id from fixture_occurrence),true)->>'replayed')::boolean,'cancel/message retry reuses receipt');
select pg_temp.ok((select status='cancelled' from public.gym_classes where id=(select id from fixture_occurrence)),'occurrence cancelled atomically');
select pg_temp.ok((select count(*)=2 from public.gym_class_announcements),'messages not duplicated');
select pg_temp.denied($q$select public.announce_gym_class_series('78000000-0000-4000-8000-000000000020','series_subscribers','Different','78000000-0000-4000-8000-000000000030')$q$,'conflicts');
select set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000002',true);
select pg_temp.ok((select count(*)=1 and min(body)='Schedule update' from public.gym_class_announcements),'subscriber cannot see occurrence-only message');
select pg_temp.ok((select count(*)=1 from public.gym_class_announcement_recipients),'subscriber sees only own delivery');
select pg_temp.denied($q$select public.announce_gym_class_series('78000000-0000-4000-8000-000000000020','series_subscribers','Forged','78000000-0000-4000-8000-000000000032')$q$,'Active gym staff');
select public.subscribe_gym_class_series('78000000-0000-4000-8000-000000000020',false);
select pg_temp.ok((select count(*)=0 from public.gym_class_series_subscriptions),'unsubscribe removes subscription');
select set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000003',true);
select pg_temp.ok((select count(*)=1 and min(body)='Cancelled today' from public.gym_class_announcements),'booked member retains cancellation inbox receipt');
select set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000007',true);
select pg_temp.ok((select count(*)=0 from public.gym_class_announcements),'other gym cannot read announcements');
reset role;
-- Audit failure must roll back publication and messaging, including cancellation.
create function pg_temp.fail_series_audit() returns trigger language plpgsql as $$
begin if new.action in ('class.series_published','class.announcement_posted') then raise exception 'fixture audit unavailable'; end if; return new; end $$;
create trigger fixture_series_audit before insert on public.audit_logs for each row execute function pg_temp.fail_series_audit();
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000001',true);
select pg_temp.denied($q$select public.publish_gym_class_series('78000000-0000-4000-8000-000000000010',pg_temp.draft()||'{"id":"78000000-0000-4000-8000-000000000022"}',12)$q$,'fixture audit unavailable');
select pg_temp.ok(not exists(select 1 from public.gym_class_series where id='78000000-0000-4000-8000-000000000022'),'audit failure rolls back series');
select pg_temp.denied($q$select public.announce_gym_class_series('78000000-0000-4000-8000-000000000020','series_subscribers','No partial delivery','78000000-0000-4000-8000-000000000033')$q$,'fixture audit unavailable');
select pg_temp.ok((select count(*)=2 from public.gym_class_announcements),'audit failure rolls back announcement');
reset role;
rollback;
\echo '[ok] recurring series publication, DST, subscriber scope, cancellation, inbox isolation, replay and audit rollback'
