create trigger trg_social_connections_set_updated_at before update on public.social_connections
for each row execute function public.set_updated_at();
