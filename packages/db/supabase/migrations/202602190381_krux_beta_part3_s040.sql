create index if not exists idx_sync_jobs_status_next_retry
  on public.device_sync_jobs(status, next_retry_at, created_at);
