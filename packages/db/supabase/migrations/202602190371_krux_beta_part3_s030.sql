create unique index if not exists idx_device_sync_cursors_user_provider
  on public.device_sync_cursors(user_id, provider);
