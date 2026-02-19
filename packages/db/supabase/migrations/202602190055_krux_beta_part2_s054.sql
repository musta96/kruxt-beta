create trigger trg_device_connections_set_updated_at before update on public.device_connections
for each row execute function public.set_updated_at();
