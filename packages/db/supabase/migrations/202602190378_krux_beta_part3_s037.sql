create trigger trg_device_sync_cursors_set_updated_at before update on public.device_sync_cursors
for each row execute function public.set_updated_at();
