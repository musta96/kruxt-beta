-- Workout proof media: attach a photo/video to a logged workout so the
-- Proof Feed can render it full-bleed (TikTok-style).
--
-- Approach: additive, non-breaking.
--  * 3 nullable columns on public.workouts (no change to log_workout_atomic RPC).
--  * A public storage bucket `workout-proof` with owner-scoped write policies.
-- The mobile client uploads the asset, then UPDATEs the workout row it owns.

-- 1. Columns on workouts ------------------------------------------------------
alter table public.workouts
  add column if not exists proof_media_url text,
  add column if not exists proof_media_type text
    check (proof_media_type is null or proof_media_type in ('image', 'video')),
  add column if not exists proof_media_thumbnail_url text;

-- 2. Storage bucket -----------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workout-proof',
  'workout-proof',
  true,
  52428800, -- 50 MB
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'video/mp4',
    'video/quicktime'
  ]
)
on conflict (id) do nothing;

-- 3. Storage RLS policies -----------------------------------------------------
-- Object path convention: `<user_id>/<workout_id>.<ext>` so the first path
-- segment is the owner's auth.uid().

-- Public read (bucket is public, but make the SELECT policy explicit).
do $$ begin
  create policy "workout_proof_public_read"
    on storage.objects for select
    using (bucket_id = 'workout-proof');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "workout_proof_owner_insert"
    on storage.objects for insert
    with check (
      bucket_id = 'workout-proof'
      and auth.uid() is not null
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "workout_proof_owner_update"
    on storage.objects for update
    using (
      bucket_id = 'workout-proof'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'workout-proof'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "workout_proof_owner_delete"
    on storage.objects for delete
    using (
      bucket_id = 'workout-proof'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;
