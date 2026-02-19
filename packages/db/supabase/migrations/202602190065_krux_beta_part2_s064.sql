create trigger trg_privacy_requests_set_updated_at before update on public.privacy_requests
for each row execute function public.set_updated_at();
