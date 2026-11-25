set role anon;
select workout_test.denied($q$select public.log_workout_atomic('{}','[]')$q$);
select workout_test.denied($q$select * from public.workout_create_receipts$q$);
reset role;
set role authenticated;
select set_config('request.jwt.claims','{}',false);
select workout_test.denied($q$select public.log_workout_atomic('{}','[]')$q$);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',false);
select workout_test.ok((select count(*) = 3 from public.workouts where user_id = '00000000-0000-4000-8000-000000000001'), 'public/followers/gym allowed; private denied');
select workout_test.ok((select count(*) = 1 from public.workout_proof_media), 'private media metadata visible before block');
select workout_test.ok((select count(*) = 1 from storage.objects), 'private storage visible before block');
select workout_test.ok(not public.can_view_workout('00000000-0000-4000-8000-000000000001','private',null,'00000000-0000-4000-8000-000000000001'), 'cannot spoof explicit viewer');
-- A workout ID obtained earlier (including a locally saved ID) confers no authority.
insert into public.user_blocks(blocker_user_id,blocked_user_id) values ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001');
select workout_test.ok((select count(*) = 0 from public.workouts where user_id = '00000000-0000-4000-8000-000000000001'), 'saved workout ID hidden after outgoing block');
select workout_test.ok((select count(*) = 0 from public.feed_events where user_id = '00000000-0000-4000-8000-000000000001'), 'feed hidden after block');
select workout_test.ok((select count(*) = 0 from public.workout_exercises where workout_id = '00000000-0000-4000-8000-000000000031'), 'exercise children hidden');
select workout_test.ok((select count(*) = 1 from public.workout_sets), 'only unblocked third-party sets visible');
select workout_test.ok((select count(*) = 0 from public.workout_proof_media), 'definer media lookup obeys block');
select workout_test.ok((select count(*) = 0 from storage.objects), 'private storage signing SELECT denied');
select workout_test.ok(not public.can_view_workout_proof_media('00000000-0000-4000-8000-000000000031'), 'media RPC denied');
select workout_test.ok(not public.can_view_workout('00000000-0000-4000-8000-000000000001','public',null), 'definer visibility RPC denied');
select workout_test.ok((select count(*) = 0 from public.social_connections), 'connection hidden without RLS recursion');
select workout_test.ok((select count(*) = 1 from public.social_interactions), 'blocked actor comments hidden even on third-party workout');
select workout_test.denied($q$insert into public.social_interactions(workout_id,actor_user_id,interaction_type,comment_text) values ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000002','comment','denied')$q$);
select workout_test.denied($q$insert into public.social_interactions(workout_id,actor_user_id,interaction_type,reaction_type) values ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000002','reaction','fire')$q$);
select workout_test.denied($q$update public.social_interactions set workout_id='00000000-0000-4000-8000-000000000031' where id='00000000-0000-4000-8000-000000000043'$q$);
with changed as (update public.social_connections set status='accepted' returning id)
select workout_test.ok(count(*) = 0, 'blocked accept changes zero rows') from changed;
select workout_test.denied($q$insert into public.social_connections(follower_user_id,followed_user_id) values ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001')$q$);
-- Reverse viewer cannot read or follow the blocker either.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',false);
select workout_test.ok((select count(*) = 4 from public.workouts where user_id=auth.uid()), 'owner retains all own audiences');
select workout_test.denied($q$insert into public.social_connections(follower_user_id,followed_user_id) values ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')$q$);
select workout_test.ok((select count(*) = 0 from public.social_interactions where actor_user_id='00000000-0000-4000-8000-000000000002'), 'incoming block hides comments');
select workout_test.ok((select count(*) = 1 from public.workout_proof_media), 'owner retains media');
select workout_test.denied($q$update public.workout_proof_media set workout_id='00000000-0000-4000-8000-000000000035'$q$);
select workout_test.denied($q$select * from public.workout_create_receipts$q$);
select workout_test.denied($q$insert into public.workout_create_receipts(user_id,idempotency_key,payload_hash) values (auth.uid(),gen_random_uuid(),decode(repeat('00',32),'hex'))$q$);
select workout_test.denied($q$select public.log_workout_atomic_legacy('{}','[]')$q$);
select workout_test.denied($q$select public.log_workout_atomic('{"idempotency_key":null}',workout_test.exercises())$q$,'22023');
select workout_test.denied($q$select public.log_workout_atomic('{"idempotency_key":"invalid"}',workout_test.exercises())$q$,'22023');
select workout_test.denied($q$select public.log_workout_atomic('{"idempotency_key":"00000000-0000-4000-8000-000000000050"}','[]')$q$,'22023');
select workout_test.denied($q$select public.log_workout_atomic(jsonb_build_object('idempotency_key','00000000-0000-4000-8000-000000000050','notes',repeat('x',262144)),workout_test.exercises())$q$,'22023');
do $$ declare
  v_id uuid; v_again uuid; v_xp integer; v_count integer;
  v_payload jsonb := '{"title":"replay","idempotency_key":"00000000-0000-4000-8000-000000000051","user_id":"00000000-0000-4000-8000-000000000002"}';
begin
  select xp_total into v_xp from public.profiles where id=auth.uid();
  v_id := public.log_workout_atomic(v_payload,workout_test.exercises());
  v_again := public.log_workout_atomic(v_payload,workout_test.exercises());
  perform workout_test.ok(v_id=v_again,'exact replay same receipt');
  perform workout_test.ok((select visibility='private' and user_id=auth.uid() from public.workouts where id=v_id),'private default and owner derived from JWT');
  perform workout_test.ok((select xp_total=v_xp+10 from public.profiles where id=auth.uid()),'progress awarded exactly once');
  perform workout_test.ok((select count(*)=1 from public.feed_events where workout_id=v_id),'feed emitted once');
  perform workout_test.denied(format('select public.log_workout_atomic(%L,workout_test.exercises())',(v_payload||'{"title":"changed"}')::text),'22023');
  perform workout_test.denied(format('select public.log_workout_atomic(%L,%L)',v_payload::text,'[{"exercise_id":"00000000-0000-4000-8000-000000000010","sets":[{"reps":6}]}]'),'22023');
  delete from public.workouts where id=v_id;
  perform workout_test.denied(format('select public.log_workout_atomic(%L,workout_test.exercises())',v_payload::text),'P0002');
  -- Exercise FK failure occurs after workout/progress/feed insertion: all must roll back.
  select count(*) into v_count from public.workouts;
  perform workout_test.denied($q$select public.log_workout_atomic('{"title":"rollback","idempotency_key":"00000000-0000-4000-8000-000000000052"}','[{"exercise_id":"00000000-0000-4000-8000-000000000999"}]')$q$,'23503');
  perform workout_test.ok((select count(*)=v_count from public.workouts),'failed create rolls back workout');
  v_id := public.log_workout_atomic('{"title":"rollback","idempotency_key":"00000000-0000-4000-8000-000000000052"}',workout_test.exercises());
  perform workout_test.ok(v_id is not null,'failed claim rolls back and permits corrected retry');
  v_id := public.log_workout_atomic('{"title":"legacy"}','[]');
  perform workout_test.ok((select visibility='private' from public.workouts where id=v_id),'unkeyed legacy API retains private default');
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',false);
select public.log_workout_atomic('{"title":"replay","idempotency_key":"00000000-0000-4000-8000-000000000051","user_id":"00000000-0000-4000-8000-000000000002"}',workout_test.exercises());
select workout_test.ok((select count(*)=1 from public.workouts where title='replay' and user_id=auth.uid()),'same key is owner scoped');
-- Unblocking restores existing visibility, not public access to private workouts.
delete from public.user_blocks where blocker_user_id=auth.uid();
select workout_test.ok((select count(*)=3 from public.workouts where user_id='00000000-0000-4000-8000-000000000001' and title in ('public','followers','gym','private')), 'unblock restores original audience permissions');
insert into public.social_connections(follower_user_id,followed_user_id) values (auth.uid(),'00000000-0000-4000-8000-000000000003');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',false);
with changed as (update public.social_connections set status='accepted' where followed_user_id=auth.uid() returning id)
select workout_test.ok(count(*) = 1, 'normal follow acceptance preserved') from changed;
reset role;
select workout_test.ok((select count(*)=1 from public.workout_create_receipts where idempotency_key='00000000-0000-4000-8000-000000000052'),'one successful claim after rollback');
select workout_test.ok((select count(*)=0 from public.feed_events f left join public.workouts w on w.id=f.workout_id where w.id is null),'no failed-create feed residue');
select 'PASS: denial assertions, owner defaults, saved-ID readback, feed, children, private media, comments, reactions, follow and replay';
