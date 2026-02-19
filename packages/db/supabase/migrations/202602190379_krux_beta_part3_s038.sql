alter table public.device_sync_jobs
add column if not exists source_webhook_event_id uuid references public.integration_webhook_events(id) on delete set null;
