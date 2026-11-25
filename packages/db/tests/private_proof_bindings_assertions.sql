-- SQL fixture only: exercises PostgreSQL RLS/triggers, not actual Storage SDK
-- uploads, signing, overwrite HTTP behavior, or hosted Storage operations.
begin;
reset role;
select workout_test.ok((select public = false from storage.buckets
  where id = 'workout-proof-media'), 'proof bucket exists and is private');

-- Deliberately invalid legacy/orphan rows bypass INSERT RLS only here.
insert into storage.objects(bucket_id, name, owner_id) values
 ('workout-proof-media', '00000000-0000-4000-8000-000000000003/00000000-0000-4000-8000-000000000035/10000000-0000-4000-8000-000000000001/victim-orphan.jpg', '00000000-0000-4000-8000-000000000003'),
 ('workout-proof-media', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000031/10000000-0000-4000-8000-000000000001/wrong-owner.jpg', '00000000-0000-4000-8000-000000000003'),
 ('workout-proof-media', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000031/10000000-0000-4000-8000-000000000001/null-owner.jpg', null),
 ('workout-proof-media', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000035/10000000-0000-4000-8000-000000000001/foreign-workout.jpg', '00000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select workout_test.denied($q$select private_proof_contract.visible_binding('guess.jpg')$q$);
do $$
declare
  uid constant text := '00000000-0000-4000-8000-000000000001';
  victim constant text := '00000000-0000-4000-8000-000000000003';
  wid constant uuid := '00000000-0000-4000-8000-000000000031';
  private_wid constant uuid := '00000000-0000-4000-8000-000000000034';
  victim_wid constant uuid := '00000000-0000-4000-8000-000000000035';
  attempt constant text := '10000000-0000-4000-8000-000000000001';
  prefix text := uid || '/' || wid || '/' || attempt || '/';
  victim_path text := victim || '/' || victim_wid || '/' || attempt || '/victim-orphan.jpg';
  proof_id uuid;
  n integer;
  path text;
  change text;
begin
  -- Normal client order: object upload, then metadata registration.
  insert into storage.objects(bucket_id, name, owner_id, metadata) values
    ('workout-proof-media', prefix || 'public-proof.jpg', uid, '{"mimetype":"image/jpeg"}'),
    ('workout-proof-media', uid || '/' || private_wid || '/' || attempt || '/private-proof.jpg', uid, '{}'),
    ('workout-proof-media', prefix || 'replacement-orphan.jpg', uid, '{}'),
    ('workout-proof-media', prefix || 'cleanup-orphan.jpg', uid, '{}');
  perform workout_test.ok((select count(*) = 4 from storage.objects
    where bucket_id = 'workout-proof-media' and name in
      (prefix || 'public-proof.jpg', uid || '/' || private_wid || '/' || attempt || '/private-proof.jpg',
       prefix || 'replacement-orphan.jpg', prefix || 'cleanup-orphan.jpg')),
    'owner can read new uploads before registration');
  insert into public.workout_proof_media(workout_id, uploader_user_id, storage_path, media_kind, mime_type, sort_order)
    values (wid, uid::uuid, prefix || 'public-proof.jpg', 'image', 'image/jpeg', 10)
    returning id into proof_id;
  insert into public.workout_proof_media(workout_id, uploader_user_id, storage_path, media_kind, mime_type, sort_order)
    values (private_wid, uid::uuid, uid || '/' || private_wid || '/' || attempt || '/private-proof.jpg', 'image', 'image/jpeg', 10);
  perform workout_test.ok((select count(*) = 1 from public.workout_proof_media where id = proof_id), 'owner reads registered metadata');
  update public.workout_proof_media set width = 640, height = 480, file_bytes = 1234 where id = proof_id;
  get diagnostics n = row_count;
  perform workout_test.ok(n = 1 and (select width = 640 and height = 480 and file_bytes = 1234
    from public.workout_proof_media where id = proof_id), 'ordinary own metadata remains editable');

  -- Missing object includes a plausible future upload path, not just malformed input.
  foreach path in array array[
    prefix || 'future-upload.jpg', victim_path, prefix || 'wrong-owner.jpg', prefix || 'null-owner.jpg',
    uid || '/' || victim_wid || '/' || attempt || '/foreign-workout.jpg'
  ] loop
    perform workout_test.denied(format($q$insert into public.workout_proof_media
      (workout_id,uploader_user_id,storage_path,media_kind,mime_type,sort_order)
      values (%L,%L,%L,'image','image/jpeg',11)$q$, wid, uid, path));
  end loop;
  perform workout_test.denied(format($q$insert into public.workout_proof_media
    (workout_id,uploader_user_id,storage_path,media_kind,mime_type,sort_order)
    values (%L,%L,%L,'image','image/jpeg',11)$q$, victim_wid, uid,
    uid || '/' || victim_wid || '/' || attempt || '/foreign-workout.jpg'));
  perform workout_test.denied(format($q$insert into public.workout_proof_media
    (workout_id,uploader_user_id,storage_path,media_kind,mime_type,sort_order)
    values (%L,%L,%L,'image','image/jpeg',11)$q$, wid, victim, prefix || 'replacement-orphan.jpg'));

  -- Each immutable identity field is checked separately; the replacement exists.
  foreach change in array array[
    format('storage_path=%L', prefix || 'replacement-orphan.jpg'),
    format('storage_path=%L', victim_path),
    format('workout_id=%L', private_wid),
    format('workout_id=%L', victim_wid),
    format('uploader_user_id=%L', victim),
    'storage_bucket=''workout-proof''', 'sort_order=12'
  ] loop
    perform workout_test.denied(format('update public.workout_proof_media set %s where id=%L', change, proof_id));
  end loop;
  perform workout_test.ok((select workout_id = wid and uploader_user_id = uid::uuid
    and storage_bucket = 'workout-proof-media' and storage_path = prefix || 'public-proof.jpg'
    and sort_order = 10 from public.workout_proof_media where id = proof_id), 'failed substitutions preserve binding');

  -- Registered bytes, name, owner, and bucket cannot be changed, even by uploader.
  foreach change in array array[
    'metadata='' {"size":9999}''::jsonb',
    format('name=%L', prefix || 'renamed-proof.jpg'),
    format('owner_id=%L', victim), 'bucket_id=''workout-proof'''
  ] loop
    execute format('update storage.objects set %s where bucket_id=''workout-proof-media'' and name=%L',
      change, prefix || 'public-proof.jpg');
    get diagnostics n = row_count;
    perform workout_test.ok(n = 0, 'registered object UPDATE affects zero rows: ' || change);
  end loop;
  delete from storage.objects where bucket_id = 'workout-proof-media' and name = prefix || 'public-proof.jpg';
  get diagnostics n = row_count;
  perform workout_test.ok(n = 0, 'registered object DELETE affects zero rows');

  -- Object insertion must validate all four segments and the actual owner_id.
  foreach path in array array[
    victim_path || '.new',
    uid || '/' || victim_wid || '/' || attempt || '/stolen-workout.jpg',
    uid || '/00000000-0000-4000-8000-000000000999/' || attempt || '/missing-workout.jpg',
    uid || '/' || wid || '/three-segments.jpg',
    prefix || 'extra/five-segments.jpg', prefix || '', prefix || '.', prefix || '..',
    uid || '/' || wid || '/not-a-uuid/bad-attempt.jpg',
    uid || '/not-a-uuid/' || attempt || '/bad-workout.jpg'
  ] loop
    perform workout_test.denied(format('insert into storage.objects(bucket_id,name,owner_id) values (''workout-proof-media'',%L,%L)', path, uid));
  end loop;
  perform workout_test.denied(format('insert into storage.objects(bucket_id,name,owner_id) values (''workout-proof-media'',%L,%L)', prefix || 'spoof-owner.jpg', victim));
  perform workout_test.denied(format('insert into storage.objects(bucket_id,name,owner_id) values (''workout-proof-media'',%L,null)', prefix || 'missing-owner.jpg'));

  perform workout_test.ok((select count(*) = 0 from storage.objects
    where bucket_id = 'workout-proof-media' and name = victim_path), 'victim orphan hidden from attacker');
  delete from storage.objects where bucket_id = 'workout-proof-media' and name = victim_path;
  get diagnostics n = row_count;
  perform workout_test.ok(n = 0, 'attacker cannot delete victim orphan');
  delete from storage.objects where bucket_id = 'workout-proof-media' and name = prefix || 'cleanup-orphan.jpg';
  get diagnostics n = row_count;
  perform workout_test.ok(n = 1, 'owner can clean up own unregistered upload');
  perform workout_test.ok((select count(*) = 0 from storage.objects where name = prefix || 'cleanup-orphan.jpg'), 'orphan cleanup removes row');
end $$;

-- Independently exercise metadata validation against existing malformed objects.
reset role;
insert into storage.objects(bucket_id, name, owner_id)
select 'workout-proof-media', path, '00000000-0000-4000-8000-000000000001'
from unnest(array[
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000031/short.jpg',
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000031/10000000-0000-4000-8000-000000000002/.',
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000031/10000000-0000-4000-8000-000000000002/..'
]) as paths(path);
set local role authenticated;
do $$ declare path text; begin
  foreach path in array array[
    '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000031/short.jpg',
    '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000031/10000000-0000-4000-8000-000000000002/.',
    '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000031/10000000-0000-4000-8000-000000000002/..'
  ] loop
    perform workout_test.denied(format($q$insert into public.workout_proof_media
      (workout_id,uploader_user_id,storage_path,media_kind,mime_type,sort_order)
      values ('00000000-0000-4000-8000-000000000031',auth.uid(),%L,'image','image/jpeg',11)$q$, path));
  end loop;
end $$;

-- User 4 is a stranger, without the accepted follow relationship of user 2.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select workout_test.ok((select count(*) = 1 from public.workout_proof_media where sort_order = 10), 'stranger reads only registered public proof');
select workout_test.ok((select count(*) = 1 from storage.objects where name like '%/10000000-0000-4000-8000-000000000001/%'), 'stranger reads public object but no private proof or orphans');
with changed as (update public.workout_proof_media set width = 999 where sort_order = 10 returning id)
select workout_test.ok(count(*) = 0, 'stranger cannot edit visible metadata') from changed;
with changed as (delete from storage.objects where name like '%/10000000-0000-4000-8000-000000000001/%' returning id)
select workout_test.ok(count(*) = 0, 'stranger cannot delete public proof or hidden orphans') from changed;
select workout_test.denied($q$insert into public.workout_proof_media
  (workout_id,uploader_user_id,storage_path,media_kind,mime_type,sort_order)
  values ('00000000-0000-4000-8000-000000000031',auth.uid(),
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000031/10000000-0000-4000-8000-000000000001/replacement-orphan.jpg',
  'image','image/jpeg',11)$q$);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select workout_test.ok((select count(*) = 1 from public.workout_proof_media where sort_order = 10), 'follower still cannot read private registered proof');
select workout_test.ok((select count(*) = 1 from storage.objects where name like '%/10000000-0000-4000-8000-000000000001/%'), 'follower sees only public registered object');
insert into public.user_blocks(blocker_user_id, blocked_user_id)
values (auth.uid(), '00000000-0000-4000-8000-000000000001');
select workout_test.ok((select count(*) = 0 from public.workout_proof_media where sort_order = 10), 'block hides registered public metadata');
select workout_test.ok((select count(*) = 0 from storage.objects where name like '%/10000000-0000-4000-8000-000000000001/%'), 'block hides registered public object');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select workout_test.ok((select count(*) = 2 from public.workout_proof_media where sort_order = 10), 'owner retains public and private metadata after incoming block');
select workout_test.ok((select count(*) = 2 from storage.objects where name like '%/10000000-0000-4000-8000-000000000001/%'
  and name in (
    '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000031/10000000-0000-4000-8000-000000000001/public-proof.jpg',
    '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000034/10000000-0000-4000-8000-000000000001/private-proof.jpg')), 'owner retains both registered objects after block');

reset role;
select workout_test.ok((select count(*) = 1 from storage.objects where name =
  '00000000-0000-4000-8000-000000000003/00000000-0000-4000-8000-000000000035/10000000-0000-4000-8000-000000000001/victim-orphan.jpg'), 'victim orphan survived attempted cleanup');
select workout_test.ok((select count(*) = 1 from public.workout_proof_media where storage_path like '%/proof.jpg'),
  'legacy metadata is preserved, not rewritten or deleted');
set local role authenticated;
select workout_test.ok((select count(*) = 0 from public.workout_proof_media where storage_path like '%/proof.jpg'),
  'legacy metadata without a verified binding is hidden even from the uploader');
set local role anon;
select workout_test.ok((select count(*) = 0 from storage.objects), 'anonymous Storage read is denied');
select workout_test.ok((select count(*) = 0 from public.workout_proof_media), 'anonymous metadata read is denied');
select 'PASS: private proof SQL bindings, immutable identity, object ownership, orphan cleanup, audience and block assertions (not Storage SDK)';
rollback;

begin isolation level repeatable read;
insert into storage.objects(bucket_id,name,owner_id) values ('workout-proof-media',
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000031/10000000-0000-4000-8000-000000000003/isolation.jpg',
  '00000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select workout_test.denied($q$insert into public.workout_proof_media
  (workout_id,uploader_user_id,storage_path,media_kind,mime_type,sort_order)
  values ('00000000-0000-4000-8000-000000000031',auth.uid(),
    '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000031/10000000-0000-4000-8000-000000000003/isolation.jpg',
    'image','image/jpeg',90)$q$);
select workout_test.denied($q$delete from storage.objects where name like '%/isolation.jpg'$q$);
select 'PASS: fixed-snapshot registration and deletion fail closed';
rollback;
