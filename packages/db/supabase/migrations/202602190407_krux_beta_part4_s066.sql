alter table public.privacy_requests
  add column if not exists response_expires_at timestamptz,
  add column if not exists response_content_type text,
  add column if not exists response_bytes bigint;

create table if not exists public.privacy_export_jobs (
  id uuid primary key default gen_random_uuid(),
  privacy_request_id uuid not null references public.privacy_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.sync_job_status not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'retry_scheduled')),
  storage_bucket text,
  storage_path text,
  signed_url text,
  signed_url_expires_at timestamptz,
  file_bytes bigint,
  record_count integer,
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (privacy_request_id)
);

create index if not exists idx_privacy_export_jobs_status_retry
  on public.privacy_export_jobs(status, next_retry_at, created_at);

create index if not exists idx_privacy_export_jobs_user_created
  on public.privacy_export_jobs(user_id, created_at desc);

drop trigger if exists trg_privacy_export_jobs_set_updated_at on public.privacy_export_jobs;
create trigger trg_privacy_export_jobs_set_updated_at
before update on public.privacy_export_jobs
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('privacy-exports', 'privacy-exports', false, 104857600, array['application/json'])
on conflict (id)
do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
