create schema workout_test;
grant usage on schema workout_test to authenticated, anon;
create function workout_test.ok(value boolean, label text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;
create function workout_test.denied(statement text, expected text default '42501')
returns void language plpgsql security invoker as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected then return; end if;
    raise exception 'Expected %, got %: %', expected, sqlstate, sqlerrm;
  end;
  raise exception 'Expected denial: %', statement;
end $$;
create function workout_test.exercises() returns jsonb language sql immutable as $$
  select '[{"exercise_id":"00000000-0000-4000-8000-000000000010","sets":[{"reps":5,"weight_kg":20}]}]'::jsonb;
$$;
insert into auth.users(id) select ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid from generate_series(1,4) i;
insert into public.profiles(id,username,display_name) select id, 'user_'||right(id::text,1), 'Fixture' from auth.users;
insert into public.exercises(id,name,slug,category) values ('00000000-0000-4000-8000-000000000010','Fixture','fixture','strength');
insert into public.gyms values ('00000000-0000-4000-8000-000000000020');
insert into public.gym_memberships select '00000000-0000-4000-8000-000000000020', id, 'active' from auth.users;
insert into public.workouts(id,user_id,title,started_at,visibility,gym_id) values
 ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000001','public',now(),'public',null),
 ('00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000001','followers',now(),'followers',null),
 ('00000000-0000-4000-8000-000000000033','00000000-0000-4000-8000-000000000001','gym',now(),'gym','00000000-0000-4000-8000-000000000020'),
 ('00000000-0000-4000-8000-000000000034','00000000-0000-4000-8000-000000000001','private',now(),'private',null),
 ('00000000-0000-4000-8000-000000000035','00000000-0000-4000-8000-000000000003','third party',now(),'public',null);
insert into public.social_connections(follower_user_id,followed_user_id,status) values
 ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','accepted');
insert into public.workout_exercises(workout_id,exercise_id,order_index)
 select id, '00000000-0000-4000-8000-000000000010',1 from public.workouts;
insert into public.workout_sets(workout_exercise_id,set_index,reps) select id,1,5 from public.workout_exercises;
insert into public.social_interactions(id,workout_id,actor_user_id,interaction_type,comment_text) values
 ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000002','comment','existing'),
 ('00000000-0000-4000-8000-000000000042','00000000-0000-4000-8000-000000000035','00000000-0000-4000-8000-000000000001','comment','on third party'),
 ('00000000-0000-4000-8000-000000000043','00000000-0000-4000-8000-000000000035','00000000-0000-4000-8000-000000000002','comment','movable');
insert into public.workout_proof_media(workout_id,uploader_user_id,storage_path,media_kind,mime_type)
 values ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001/proof.jpg','image','image/jpeg');
insert into storage.objects(bucket_id,name) select storage_bucket, storage_path from public.workout_proof_media;
