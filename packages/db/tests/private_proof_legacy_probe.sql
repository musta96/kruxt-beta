-- Reproduce the old policy gap using synthetic objects; never run against real data.
begin;
insert into storage.objects(bucket_id, name, owner)
values ('workout-proof-media', '00000000-0000-4000-8000-000000000003/orphan.jpg',
  '00000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select workout_test.ok(not exists (select 1 from storage.objects where name like '%/orphan.jpg'),
  'victim orphan is initially hidden');
insert into public.workout_proof_media(workout_id, uploader_user_id, storage_path, media_kind, mime_type, sort_order)
values ('00000000-0000-4000-8000-000000000031', auth.uid(),
  '00000000-0000-4000-8000-000000000003/orphan.jpg', 'image', 'image/jpeg', 80);
select workout_test.ok(exists (select 1 from storage.objects where name like '%/orphan.jpg'),
  'legacy flaw reproduced: substituted metadata exposes victim orphan');
do $$ begin
  if current_setting('kruxt.proof_probe_root_only', true) = 'on' then
    update public.workout_proof_media set workout_id = '00000000-0000-4000-8000-000000000035'
    where sort_order = 80;
    perform workout_test.ok(found, 'legacy root flaw reproduced: foreign workout reassignment');
  else
    perform workout_test.denied($q$update public.workout_proof_media
      set workout_id = '00000000-0000-4000-8000-000000000035' where sort_order = 80$q$);
  end if;
end $$;
select 'PASS: reproduced synthetic legacy path substitution and checked lineage-specific reassignment';
rollback;
