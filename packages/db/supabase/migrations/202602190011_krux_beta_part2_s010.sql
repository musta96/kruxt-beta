create trigger trg_gyms_set_updated_at before update on public.gyms
for each row execute function public.set_updated_at();
