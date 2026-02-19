create unique index if not exists idx_sync_jobs_connection_webhook_event
  on public.device_sync_jobs(connection_id, source_webhook_event_id);
