create or replace function public.can_view_workout_proof_media(
  _workout_id uuid,
  _viewer uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workouts w
    where w.id = _workout_id
      and public.can_view_workout(w.user_id, w.visibility, w.gym_id, _viewer)
  );
$$;

create table if not exists public.workout_proof_media (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  uploader_user_id uuid not null references public.profiles(id) on delete cascade,
  storage_bucket text not null default 'workout-proof-media'
    check (storage_bucket = 'workout-proof-media'),
  storage_path text not null unique,
  media_kind text not null check (media_kind in ('image', 'video')),
  mime_type text not null,
  file_bytes bigint not null default 0 check (file_bytes >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  sort_order integer not null default 1 check (sort_order >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workout_id, sort_order)
);

create index if not exists idx_workout_proof_media_workout_created
  on public.workout_proof_media(workout_id, created_at desc);

create index if not exists idx_workout_proof_media_uploader_created
  on public.workout_proof_media(uploader_user_id, created_at desc);

drop trigger if exists trg_workout_proof_media_set_updated_at on public.workout_proof_media;
create trigger trg_workout_proof_media_set_updated_at
before update on public.workout_proof_media
for each row execute function public.set_updated_at();

alter table public.workout_proof_media enable row level security;

drop policy if exists workout_proof_media_select_visible on public.workout_proof_media;
create policy workout_proof_media_select_visible
on public.workout_proof_media for select to authenticated
using (public.can_view_workout_proof_media(workout_id, auth.uid()));

drop policy if exists workout_proof_media_insert_owner on public.workout_proof_media;
create policy workout_proof_media_insert_owner
on public.workout_proof_media for insert to authenticated
with check (
  uploader_user_id = auth.uid()
  and exists (
    select 1
    from public.workouts w
    where w.id = workout_proof_media.workout_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists workout_proof_media_update_owner on public.workout_proof_media;
create policy workout_proof_media_update_owner
on public.workout_proof_media for update to authenticated
using (uploader_user_id = auth.uid())
with check (uploader_user_id = auth.uid());

drop policy if exists workout_proof_media_delete_owner on public.workout_proof_media;
create policy workout_proof_media_delete_owner
on public.workout_proof_media for delete to authenticated
using (uploader_user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workout-proof-media',
  'workout-proof-media',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id)
do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists workout_proof_media_select_visible on storage.objects;
create policy workout_proof_media_select_visible
on storage.objects for select to authenticated
using (
  bucket_id = 'workout-proof-media'
  and exists (
    select 1
    from public.workout_proof_media wpm
    where wpm.storage_bucket = storage.objects.bucket_id
      and wpm.storage_path = storage.objects.name
      and public.can_view_workout_proof_media(wpm.workout_id, auth.uid())
  )
);

drop policy if exists workout_proof_media_insert_own on storage.objects;
create policy workout_proof_media_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'workout-proof-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists workout_proof_media_update_own on storage.objects;
create policy workout_proof_media_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'workout-proof-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'workout-proof-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists workout_proof_media_delete_own on storage.objects;
create policy workout_proof_media_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'workout-proof-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
