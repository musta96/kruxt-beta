create table if not exists public.device_sync_cursors (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references public.device_connections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider public.integration_provider not null,
  cursor jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_job_id uuid references public.device_sync_jobs(id) on delete set null,
  last_webhook_event_id uuid references public.integration_webhook_events(id) on delete set null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
